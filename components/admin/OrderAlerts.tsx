'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { orderNumber } from '@/lib/orders';
import { VAPID_PUBLIC_KEY } from '@/lib/vapid';

// התראות על הזמנה חדשה:
// 1) "התראות לטלפון": התראה אמיתית בטלפון/מחשב גם כשהאתר סגור (Web Push). באייפון צריך קודם
//    להוסיף את האתר למסך הבית (שיתוף ← הוספה למסך הבית) ולפתוח משם.
// 2) כשפאנל הניהול פתוח: צליל, הודעה קופצת ומספר בכותרת הלשונית. בודק כל 20 שניות.

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
const isIos = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t);
      o.stop(t + 0.17);
    });
  } catch {
    // אין צליל בדפדפן הזה
  }
}

export default function OrderAlerts() {
  const since = useRef(new Date().toISOString());
  const seen = useRef(new Set<string>());
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState<string>('default');
  // מצב ההתראות לטלפון במכשיר הזה
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'unsupported' | 'ios-install' | 'working'>('unknown');

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    (async () => {
      if (!pushSupported()) {
        setPushState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub && Notification.permission === 'granted' ? 'on' : 'off');
        // שומרים שוב (למקרה שהמנוי התחדש)
        if (sub && Notification.permission === 'granted') await saveSubscription(sub);
      } catch {
        setPushState('off');
      }
    })();
  }, []);

  const saveSubscription = async (sub: PushSubscription) => {
    const json = sub.toJSON() as any;
    const { error } = await supabase.from('push_subscriptions').upsert(
      { endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, device: navigator.userAgent.slice(0, 200) },
      { onConflict: 'endpoint' }
    );
    return error;
  };

  const enablePush = async () => {
    setPushState('working');
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        showToast('ההתראות חסומות. אפשר לאשר אותן בהגדרות הדפדפן', { kind: 'error' });
        setPushState('off');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
      const error = await saveSubscription(sub);
      if (error) {
        showToast(
          /relation|does not exist|schema cache/i.test(error.message) ? 'צריך קודם להריץ ב-Supabase את הקובץ supabase/2026-11-push-alerts.sql' : 'השמירה נכשלה: ' + error.message,
          { kind: 'error' }
        );
        setPushState('off');
        return;
      }
      setPushState('on');
      reg.showNotification('✅ ההתראות פועלות', { body: 'מעכשיו תקבלו כאן התראה על כל הזמנה חדשה', icon: '/Logo.JPG' });
    } catch (err: any) {
      showToast('לא הצלחנו להפעיל התראות: ' + (err?.message || ''), { kind: 'error' });
      setPushState('off');
    }
  };

  const disablePush = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setPushState('off');
      showToast('ההתראות לטלפון כובו במכשיר הזה', { kind: 'success' });
    }
  };

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = unread ? `(${unread}) ${base}` : base;
  }, [unread]);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, customer_name, total_price, total, created_at')
        .gt('created_at', since.current)
        .order('created_at', { ascending: true })
        .limit(20);
      const fresh = (data || []).filter((o: any) => !seen.current.has(o.id));
      if (!fresh.length) return;
      fresh.forEach((o: any) => seen.current.add(o.id));
      since.current = fresh[fresh.length - 1].created_at;
      setUnread((u) => u + fresh.length);
      beep();
      for (const o of fresh) {
        const total = Math.round(Number(o.total_price || o.total || 0)).toLocaleString();
        const text = `${o.customer_name || 'לקוח'} · ₪${total}`;
        showToast(`🛍️ הזמנה חדשה! ${text}`, { kind: 'success', action: { href: `/admin/orders?q=${orderNumber(o.id)}`, label: 'לפתיחה' } });
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification('🛍️ הזמנה חדשה ב-NEW PHONE', { body: text, icon: '/Logo.JPG', tag: o.id });
          } catch {
            // בחלק מהטלפונים התראות עובדות רק מאפליקציה מותקנת
          }
        }
      }
    };
    const t = setInterval(check, 20000);
    const onFocus = () => setUnread(0);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (pushState === 'unknown' || pushState === 'unsupported') return null;
  if (pushState === 'ios-install') {
    return (
      <button
        onClick={() => showToast('באייפון: לוחצים על "שיתוף" בספארי ← "הוספה למסך הבית", פותחים את NEW PHONE מהמסך ומפעילים כאן התראות', { kind: 'info' })}
        className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 cursor-pointer"
      >
        🔔 התראות לאייפון
      </button>
    );
  }
  if (pushState === 'on') {
    return (
      <button
        onClick={disablePush}
        className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-800 border border-green-200 cursor-pointer"
        title="לחיצה מכבה את ההתראות במכשיר הזה"
      >
        🔔 התראות פועלות
      </button>
    );
  }
  return (
    <button
      onClick={enablePush}
      disabled={pushState === 'working'}
      className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-green-600 text-white cursor-pointer disabled:opacity-60"
      title="התראה בטלפון על כל הזמנה חדשה, גם כשהאתר סגור"
    >
      🔔 {pushState === 'working' ? 'מפעיל...' : 'הפעלת התראות לטלפון'}
    </button>
  );
}
