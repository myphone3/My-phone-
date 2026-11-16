import webpush from 'web-push';

export function pusher() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return null;
  webpush.setVapidDetails('https://kabalot-kappa.vercel.app', pub, priv);
  return webpush;
}
