// נעילה בקוד ברמת הארכיון: הקוד נבדק בשרת, ובלעדיו אי אפשר לראות או לשנות קבלות — בשום מכשיר.
// אחרי הקלדת קוד נכון השרת נותן "כרטיס כניסה" לטלפון הזה (180 יום). בכל פתיחה של האפליקציה
// מבקשים שוב קוד, או טביעת אצבע / Face ID של הטלפון (רשום לכל טלפון בנפרד).
import { supabase } from './supabase';
import { getPref, setPref } from './local';

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

export const getToken = (vault) => getPref('tok_' + vault, null);
export const setToken = (vault, t) => setPref('tok_' + vault, t || null);

// כל קריאה לשרת עם כרטיס הכניסה של הטלפון הזה
export const rpc = (fn, vault, args = {}) => supabase.rpc(fn, { p_vault: vault, ...args, p_token: getToken(vault) });

// מחזיר {token} או {error:'bad', left} או {error:'wait', minutes}
export async function unlock(vault, pin) {
  const { data, error } = await supabase.rpc('wr_unlock', { p_vault: vault, p_pin: pin });
  if (error) return { error: 'net' };
  if (data?.token) setToken(vault, data.token);
  return data || { error: 'net' };
}
export async function setPin(vault, pin) {
  const { data, error } = await rpc('wr_set_pin', vault, { p_pin: pin });
  if (error) throw error;
  setToken(vault, data.token);
  return data.recovery;
}
export async function clearPin(vault) {
  const { error } = await rpc('wr_clear_pin', vault);
  if (error) throw error;
  removeBio(vault);
}

// פתוח בחלון הזה (עד שהאפליקציה ברקע יותר מדקה)
export const markOpen = (vault) => { try { sessionStorage.setItem('wr_open_' + vault, '1'); } catch {} };
export const isOpen = (vault) => { try { return !!sessionStorage.getItem('wr_open_' + vault); } catch { return false; } };
export const close = (vault) => { try { sessionStorage.removeItem('wr_open_' + vault); } catch {} };

// טביעת אצבע / Face ID — לכל טלפון ולכל ארכיון בנפרד
export async function bioAvailable() {
  try { return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch { return false; }
}
export const hasBio = (vault) => !!getPref('bio_' + vault, null);
export function removeBio(vault) { setPref('bio_' + vault, null); }
export async function addBio(vault, name) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'קבלות ואחריות' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'kabalot-' + vault.slice(0, 8), displayName: name || 'קבלות ואחריות' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  setPref('bio_' + vault, b64u(cred.rawId));
}
export async function checkBio(vault) {
  const id = getPref('bio_' + vault, null);
  if (!id) return false;
  const a = await navigator.credentials.get({
    publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(id) }], userVerification: 'required', timeout: 60000 },
  });
  return !!a;
}
