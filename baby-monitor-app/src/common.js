import { createClient } from '@supabase/supabase-js';
import { registerPlugin, Capacitor } from '@capacitor/core';

// ---------- הגדרות ----------
// כתובת ומפתח ציבוריים של Supabase של החנות (אותם ערכים שמופיעים באתר). אפשר לדרוס ב-VITE_*
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://iiaxizrezhczgutqijbe.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GlpxeLkaiEs9zbILs_oeUg_HU5xMKfu';
const TURN_URLS = (import.meta.env.VITE_TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);

export const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    ...(TURN_URLS.length
      ? [{ urls: TURN_URLS, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }]
      : []),
  ],
};

export const HEARTBEAT_MS = 5000; // מכשיר התינוק מדווח שהוא חי
export const LOST_MS = 20000; // אחרי כמה זמן בלי דיווח ההורה מקבל התראה
export const RELAY_AFTER_MS = 12000; // אם השמע הישיר לא התחבר עד אז, עוברים לשמע דרך השרת
export const RELAY_RATE = 8000; // איכות טלפון
export const RELAY_CHUNK_MS = 500;

export const native = Capacitor.isNativePlatform();
export const Monitor = registerPlugin('Monitor');
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { worker: true } });
export const app = document.getElementById('app');

export const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  json(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  setJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export const rid = () => Math.random().toString(36).slice(2, 10);
export const time = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
export const timeSec = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export const dayTime = (ts) => {
  const d = new Date(ts), today = new Date();
  const same = d.toDateString() === today.toDateString();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  return (same ? '' : d.toDateString() === y.toDateString() ? 'אתמול ' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }) + ' ') + time(ts);
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = app) => root.querySelector(sel);
export const $$ = (sel, root = app) => root.querySelectorAll(sel);

// טיימר שרץ ב-Worker, כדי שלא ייעצר כשהמסך כבוי
export function ticker(ms, fn) {
  const w = new Worker(URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${ms})`], { type: 'text/javascript' })));
  w.onmessage = fn;
  return () => w.terminate();
}

export function levelFrom(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8);
  return Math.max(0, Math.min(100, Math.round((db + 70) * (100 / 60))));
}

export function setMeter(el, level, threshold) {
  if (!el) return;
  const bar = el.querySelector('i');
  bar.style.width = level + '%';
  bar.style.background = level > 70 ? 'var(--bad)' : level > 40 ? 'var(--moon)' : 'var(--ok)';
  const t = el.querySelector('s');
  if (t && threshold != null) t.style.left = threshold + '%';
}

export async function nativeCall(name, args) {
  if (!native) return null;
  try { return await Monitor[name](args || {}); } catch (e) { console.warn(name, e); return null; }
}

export function toast(text, onClick) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement(onClick ? 'button' : 'div');
  t.className = 'toast';
  t.textContent = text;
  if (onClick) t.onclick = () => { t.remove(); onClick(); };
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 8000);
}

// ---------- קידוד שמע לגיבוי דרך השרת (μ-law, 8kHz) ----------
export function muEncode(x) {
  const s = Math.max(-1, Math.min(1, x)) * 32635;
  const sign = s < 0 ? 0x80 : 0;
  const v = Math.abs(s) + 132;
  let exp = 7;
  for (let mask = 0x4000; (v & mask) === 0 && exp > 0; exp--, mask >>= 1);
  const man = (v >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | man) & 0xff;
}
export function muDecode(b) {
  b = ~b & 0xff;
  const sign = b & 0x80, exp = (b >> 4) & 7, man = b & 0x0f;
  const v = (((man << 3) + 132) << exp) - 132;
  return (sign ? -v : v) / 32768;
}

export function channelFor(code) {
  return supabase.channel('bm-' + code, { config: { broadcast: { self: false, ack: false } } });
}

// ---------- ניווט בין מסכים ----------
export const views = {};
let teardown = () => {};
export function setTeardown(fn) { teardown = fn; }
export function go(name, opts) {
  teardown();
  teardown = () => {};
  document.querySelectorAll('.toast,.dim').forEach((e) => e.remove());
  views[name](opts || {});
}

export function toggleRow(id, label, on, hint = '') {
  return `<label class="toggle" for="${id}"><span><b>${label}</b>${hint ? `<span class="muted small" style="display:block">${hint}</span>` : ''}</span>
    <input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
}

export function batteryHint(container) {
  if (!native) return;
  nativeCall('batteryStatus').then((r) => {
    if (!r || r.unrestricted) return;
    const d = document.createElement('div');
    d.className = 'warn';
    d.innerHTML = `<b>כדי שהאפליקציה לא תיעצר ברקע</b><div class="small">אשרו לאפליקציה לפעול ללא הגבלת סוללה.</div>
      <button class="btn dark" style="margin-top:10px">פתיחת הגדרת סוללה</button>`;
    d.querySelector('button').onclick = () => nativeCall('openBatterySettings').then(() => d.remove());
    container.appendChild(d);
  });
}

export async function deviceInfo() {
  const r = await nativeCall('deviceInfo');
  if (r) return r;
  try {
    const b = await navigator.getBattery?.();
    if (b) return { battery: Math.round(b.level * 100), charging: b.charging };
  } catch {}
  return {};
}

export function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

// ---------- צלילי הרגעה (מנוגנים במכשיר התינוק) ----------
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.0, A4 = 440.0;
// "כוכב קטן" - לחן עממי
const MELODY = [
  [C4, 1], [C4, 1], [G4, 1], [G4, 1], [A4, 1], [A4, 1], [G4, 2],
  [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 1], [D4, 1], [C4, 2],
  [G4, 1], [G4, 1], [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 2],
  [G4, 1], [G4, 1], [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 2],
  [C4, 1], [C4, 1], [G4, 1], [G4, 1], [A4, 1], [A4, 1], [G4, 2],
  [F4, 1], [F4, 1], [E4, 1], [E4, 1], [D4, 1], [D4, 1], [C4, 2],
];
export const SOUNDS = { none: 'כבוי', white: '🌊 רעש לבן', lullaby: '🎵 שיר ערש' };

export function soundPlayer(ctx) {
  let out = null, next = 0;
  const nodes = new Set();
  let state = { type: 'none', until: 0, vol: 0.5 };
  function stop() {
    nodes.forEach((n) => { try { n.stop(); } catch {} });
    nodes.clear();
    out?.disconnect(); out = null;
    state = { ...state, type: 'none', until: 0 };
  }
  function scheduleMelody() {
    while (next < ctx.currentTime + 15) {
      for (const [f, beats] of MELODY) {
        const d = beats * 0.6;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, next);
        g.gain.exponentialRampToValueAtTime(0.4, next + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, next + d * 0.95);
        o.connect(g).connect(out);
        o.start(next); o.stop(next + d);
        nodes.add(o); o.onended = () => nodes.delete(o);
        next += d;
      }
      next += 1.5;
    }
  }
  function play(type, minutes, vol) {
    stop();
    if (!SOUNDS[type] || type === 'none') return;
    out = ctx.createGain();
    out.gain.value = vol;
    out.connect(ctx.destination);
    state = { type, vol, until: minutes ? Date.now() + minutes * 60000 : 0 };
    if (type === 'white') {
      const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // רעש "חום" רך
      const s = ctx.createBufferSource();
      s.buffer = buf; s.loop = true; s.connect(out); s.start();
      nodes.add(s);
    } else {
      next = ctx.currentTime + 0.2;
      scheduleMelody();
    }
  }
  return {
    play, stop,
    tick() {
      if (state.until && Date.now() > state.until) stop();
      else if (state.type === 'lullaby' && out) scheduleMelody();
    },
    get state() { return state; },
  };
}
