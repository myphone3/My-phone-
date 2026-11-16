// נעילה בטלפון הזה: קוד של 4 ספרות (נשמר מוצפן) ואופציונלית טביעת אצבע / זיהוי פנים של הטלפון
import { getPref, setPref } from './local';

const enc = (s) => new TextEncoder().encode(s);
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function hash(pin, salt) { return hex(await crypto.subtle.digest('SHA-256', enc(salt + ':' + pin))); }

export const lockInfo = () => getPref('lock', null); // {salt, hash, cred}
export const lockOn = () => !!lockInfo()?.hash;

export async function setPin(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  setPref('lock', { ...(lockInfo() || {}), salt, hash: await hash(pin, salt) });
}
export async function checkPin(pin) {
  const l = lockInfo();
  return !!l && (await hash(pin, l.salt)) === l.hash;
}
export function clearLock() { setPref('lock', null); sessionStorage.removeItem('wr_unlocked'); }

export async function bioAvailable() {
  try { return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch { return false; }
}
export async function addBio() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'קבלות ואחריות' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'kabalot', displayName: 'קבלות ואחריות' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  setPref('lock', { ...(lockInfo() || {}), cred: b64u(cred.rawId) });
}
export function removeBio() { const l = lockInfo(); if (l) setPref('lock', { ...l, cred: null }); }
export async function checkBio() {
  const l = lockInfo();
  if (!l?.cred) return false;
  const a = await navigator.credentials.get({
    publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(l.cred) }], userVerification: 'required', timeout: 60000 },
  });
  return !!a;
}

// פתוח עד שהאפליקציה ברקע יותר מדקה
export const markUnlocked = () => { try { sessionStorage.setItem('wr_unlocked', String(Date.now())); } catch {} };
export const isUnlocked = () => { try { return !!sessionStorage.getItem('wr_unlocked'); } catch { return false; } };
export const relock = () => { try { sessionStorage.removeItem('wr_unlocked'); } catch {} };
