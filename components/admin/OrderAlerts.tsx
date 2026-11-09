'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { orderNumber } from '@/lib/orders';

// התראה בזמן אמת על הזמנה חדשה כשפאנל הניהול פתוח: צליל, הודעה קופצת, מספר בכותרת הלשונית,
// והתראה של הדפדפן/הטלפון (אם אישרתם). בודק כל 20 שניות.

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

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

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

  if (permission !== 'default' || typeof Notification === 'undefined') return null;
  return (
    <button
      onClick={async () => setPermission(await Notification.requestPermission())}
      className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-green-600 text-white cursor-pointer"
      title="קבלת התראה על כל הזמנה חדשה"
    >
      🔔 הפעלת התראות על הזמנות
    </button>
  );
}
