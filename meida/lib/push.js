// התראות לטלפון (הודעות חדשות ותזכורות)
import { api } from './api';

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!KEY;
export const isIOSNotInstalled = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.navigator.standalone || matchMedia('(display-mode: standalone)').matches);

export async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(shop) {
  if (!pushSupported()) throw new Error(isIOSNotInstalled() ? 'באייפון צריך קודם להתקין את האפליקציה למסך הבית' : 'הטלפון הזה לא תומך בהתראות');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('ההתראות חסומות. אפשר לאשר בהגדרות הדפדפן');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(KEY) });
  await api.pushSave(shop, sub.toJSON());
  try { localStorage.setItem('kb_push_' + shop, '1'); } catch {}
  return true;
}

export async function disablePush(shop) {
  const sub = await currentSub();
  await api.pushOff(shop, sub?.endpoint || null);
  try { localStorage.setItem('kb_push_' + shop, '0'); } catch {}
}

export function pushState(shop) {
  try { return localStorage.getItem('kb_push_' + shop); } catch { return null; }
}
