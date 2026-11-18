// שליחת התראות (בשרת)
import webpush from 'web-push';

let ready = false;
function setup() {
  if (ready) return true;
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails('https://meida-myphone3.vercel.app', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  ready = true;
  return true;
}

// מחזיר את הכתובות שכבר לא בתוקף (כדי לכבות אותן)
export async function sendAll(targets, payload) {
  if (!setup()) return [];
  const dead = [];
  const body = JSON.stringify(payload);
  await Promise.all((targets || []).map(async (t) => {
    try { await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, { TTL: 60 * 60 * 12 }); }
    catch (e) { if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(t.endpoint); }
  }));
  return dead;
}

export const KIND_LABEL = { message: '💬 הודעה', promo: '🏷️ מבצע', stock: '📦 מלאי', task: '✅ משימה', reminder: '⏰ תזכורת' };
