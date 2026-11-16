// התראות לטלפון: הרשמה וביטול. הטלפון נרשם לארכיון, והשרת שולח פעם ביום מה שמתקרב לסוף האחריות.
import { supabase } from './supabase';
import { rpc } from './lock';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function b64(s) {
  const p = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupport() {
  if (typeof window === 'undefined') return 'no';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return ios ? 'ios-install' : 'no';
  }
  return 'ok';
}

// מחזיר: 'ok' | 'denied' | 'no' | 'error'
export async function enablePush(vaultId) {
  if (pushSupport() !== 'ok' || !KEY) return 'no';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
    const { error } = await rpc('wr_push_subscribe', vaultId, { p_sub: sub.toJSON() });
    if (error) throw error;
    fetch('/api/push-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), vault: vaultId }) }).catch(() => {});
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.rpc('wr_push_unsubscribe', { p_endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch {}
}
