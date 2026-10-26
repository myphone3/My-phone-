// Sends Web Push notifications. Called every minute by the database (attendance_dispatch) with a shared secret.
const crypto = require("crypto");
const webpush = require("web-push");

function sameSecret(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!sameSecret(req.headers["x-push-secret"], process.env.PUSH_SECRET)) return res.status(401).json({ error: "unauthorized" });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://shaon-nochechut.vercel.app", process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const messages = Array.isArray(req.body && req.body.messages) ? req.body.messages.slice(0, 500) : [];
  const results = await Promise.allSettled(messages.map(m => webpush.sendNotification(
    { endpoint: m.endpoint, keys: { p256dh: m.p256dh, auth: m.auth } },
    JSON.stringify({ title: String(m.title || "").slice(0, 120), body: String(m.body || "").slice(0, 300), tag: String(m.tag || "attendance").slice(0, 40) }),
    { TTL: 3600, urgency: "high" }
  )));
  const gone = results.map((r, i) => r.status === "rejected" && [404, 410].includes(r.reason && r.reason.statusCode) ? messages[i].endpoint : null).filter(Boolean);
  res.status(200).json({ sent: results.filter(r => r.status === "fulfilled").length, failed: results.filter(r => r.status === "rejected").length, gone });
};
