// היסטוריה: הקלטות קצרות ומד עוצמת קול שנשמרים במכשיר התינוק (IndexedDB),
// וגרף "מוניטור לב" במכשיר ההורה שממנו קופצים להקלטה של רגע מסוים.

export const STEP = 5000; // נקודה בגרף כל 5 שניות
export const HOUR = 3600000;
const PER_HOUR = HOUR / STEP;
const EMPTY = 255;
export const SEGMENT_MS = 30000;

// ---------- IndexedDB ----------
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('bm-history', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('meta', { keyPath: 's' });
        d.createObjectStore('blobs', { keyPath: 's' });
        d.createObjectStore('levels', { keyPath: 'h' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}
function run(stores, mode, fn) {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction(stores, mode);
    let out;
    const r = fn(t);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
const put = (store, v) => run([store], 'readwrite', (t) => t.objectStore(store).put(v));
const get = (store, k) => run([store], 'readonly', (t) => t.objectStore(store).get(k));
const all = (store, range) => run([store], 'readonly', (t) => t.objectStore(store).getAll(range));
const delRange = (stores, range) => run(stores, 'readwrite', (t) => { stores.forEach((s) => t.objectStore(s).delete(range)); });

// ---------- מכשיר התינוק: מד עוצמה ----------
export class LevelLog {
  constructor() { this.hours = new Map(); this.dirty = new Set(); }
  add(ts, level) {
    const h = Math.floor(ts / HOUR) * HOUR;
    let arr = this.hours.get(h);
    if (!arr) {
      arr = new Uint8Array(PER_HOUR).fill(EMPTY);
      this.hours.set(h, arr);
      get('levels', h).then((r) => { if (r) for (let i = 0; i < PER_HOUR; i++) if (arr[i] === EMPTY) arr[i] = r.d[i]; }).catch(() => {});
    }
    const i = Math.floor((ts - h) / STEP);
    if (arr[i] === EMPTY || level > arr[i]) arr[i] = level;
    this.dirty.add(h);
  }
  async flush() {
    const now = Date.now();
    for (const h of this.dirty) await put('levels', { h, d: this.hours.get(h) }).catch(() => {});
    this.dirty.clear();
    for (const h of this.hours.keys()) if (h < now - 2 * HOUR) this.hours.delete(h);
  }
  async range(since, until) {
    const out = new Uint8Array(Math.ceil((until - since) / STEP)).fill(EMPTY);
    for (let h = Math.floor(since / HOUR) * HOUR; h < until; h += HOUR) {
      const arr = this.hours.get(h) || (await get('levels', h).catch(() => null))?.d;
      if (!arr) continue;
      for (let i = 0; i < PER_HOUR; i++) {
        const t = h + i * STEP;
        if (t >= since && t < until && arr[i] !== EMPTY) out[Math.floor((t - since) / STEP)] = arr[i];
      }
    }
    return out;
  }
  prune(before) { return delRange(['levels'], IDBKeyRange.upperBound(before, true)).catch(() => {}); }
}

// ---------- מכשיר התינוק: הקלטה רציפה בקטעים של 30 שניות ----------
function pickMime(video) {
  const opts = video
    ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return opts.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

export class Recorder {
  constructor(retentionHours) { this.retention = retentionHours * HOUR; this.mr = null; this.stopped = false; }
  start(stream) { this.stream = stream; this.stopped = false; this.rotate(); }
  setStream(stream) { this.stream = stream; this.rotate(); }
  setRetention(hours) { this.retention = hours * HOUR; this.prune(); }
  // נקרא מהטיימר הראשי; פותח קטע חדש כל 30 שניות
  tick() { if (this.mr && Date.now() - this.segStart >= SEGMENT_MS) this.rotate(); }
  rotate() {
    if (this.stopped || !window.MediaRecorder) return;
    const old = this.mr;
    const video = this.stream.getVideoTracks().some((t) => t.readyState === 'live');
    const mime = pickMime(video);
    let mr;
    try {
      mr = new MediaRecorder(this.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000, videoBitsPerSecond: 250000 });
    } catch (e) { console.warn('recorder', e); this.mr = null; return; }
    const chunks = [];
    const s = Date.now();
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: mr.mimeType || mime });
      if (blob.size > 1000) this.save({ s, e: Date.now(), v: video, mime: blob.type, size: blob.size }, blob);
    };
    mr.start(5000);
    this.mr = mr;
    this.segStart = s;
    if (old && old.state !== 'inactive') old.stop();
  }
  stop() { this.stopped = true; if (this.mr && this.mr.state !== 'inactive') this.mr.stop(); this.mr = null; }
  async save(meta, blob) {
    try {
      await put('blobs', { s: meta.s, blob });
      await put('meta', meta);
    } catch (e) { console.warn('save clip', e); }
    this.prune();
  }
  async prune() {
    const cutoff = Date.now() - this.retention;
    await delRange(['meta', 'blobs'], IDBKeyRange.upperBound(cutoff, true)).catch(() => {});
    // אם הזיכרון כמעט מלא, מוחקים את הישנים ביותר
    try {
      const est = await navigator.storage?.estimate?.();
      if (est && est.quota && est.usage > est.quota * 0.85) {
        const metas = await all('meta');
        if (metas.length > 4) await delRange(['meta', 'blobs'], IDBKeyRange.upperBound(metas[Math.floor(metas.length / 4)].s, true));
      }
    } catch {}
  }
}

// טווחי זמן שיש בהם הקלטה, מאוחדים לרצפים
export async function recordedSpans(since) {
  const metas = await all('meta', IDBKeyRange.lowerBound(since - SEGMENT_MS * 2)).catch(() => []);
  const spans = [];
  for (const m of metas) {
    const last = spans[spans.length - 1];
    if (last && m.s - last[1] < 5000 && last[2] === (m.v ? 1 : 0)) last[1] = m.e;
    else spans.push([m.s, m.e, m.v ? 1 : 0]);
  }
  return spans.filter((s) => s[1] > since);
}

export async function storageInfo() {
  const metas = await all('meta').catch(() => []);
  const bytes = metas.reduce((a, m) => a + (m.size || 0), 0);
  const first = metas[0]?.s;
  return { bytes, since: first || null, count: metas.length };
}

export async function findClip(at) {
  const metas = await all('meta', IDBKeyRange.lowerBound(at - 3 * SEGMENT_MS)).catch(() => []);
  return metas.find((m) => m.s <= at && at < m.e) || metas.find((m) => m.s > at) || null;
}
export const clipBlob = async (s) => (await get('blobs', s).catch(() => null))?.blob || null;

// שליחת הקלטה בערוץ הנתונים הישיר (WebRTC)
export async function sendClip(dc, req) {
  const send = (o) => dc.readyState === 'open' && dc.send(typeof o === 'string' ? o : JSON.stringify(o));
  const meta = await findClip(req.at);
  const blob = meta && (await clipBlob(meta.s));
  if (!meta || !blob) { send({ t: 'clip', id: req.id, none: true }); return; }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  send({ t: 'clip', id: req.id, meta });
  dc.bufferedAmountLowThreshold = 256 * 1024;
  for (let off = 0; off < bytes.length; off += 16384) {
    if (dc.readyState !== 'open') return;
    while (dc.bufferedAmount > 1024 * 1024) await new Promise((r) => setTimeout(r, 30));
    dc.send(bytes.slice(off, off + 16384));
  }
  send({ t: 'end', id: req.id });
}

// מכשיר ההורה: קבלת הקלטות
export function clipReceiver() {
  let dc = null, pending = null, nextId = 1;
  const cache = new Map();
  function onMessage(e) {
    if (!pending) return;
    if (typeof e.data === 'string') {
      const m = JSON.parse(e.data);
      if (m.id !== pending.id) return;
      if (m.t === 'clip') {
        if (m.none) { pending.resolve(null); pending = null; } else pending.meta = m.meta;
      } else if (m.t === 'end') {
        const clip = { meta: pending.meta, blob: new Blob(pending.parts, { type: pending.meta.mime }) };
        cache.set(clip.meta.s, clip);
        if (cache.size > 20) cache.delete(cache.keys().next().value);
        pending.resolve(clip);
        pending = null;
      }
    } else pending.parts.push(e.data);
  }
  return {
    attach(channel) { dc = channel; dc.binaryType = 'arraybuffer'; dc.onmessage = onMessage; },
    get ready() { return !!dc && dc.readyState === 'open'; },
    request(at) {
      for (const c of cache.values()) if (c.meta.s <= at && at < c.meta.e) return Promise.resolve(c);
      if (!dc || dc.readyState !== 'open') return Promise.reject(new Error('no_channel'));
      pending?.resolve(null);
      return new Promise((resolve) => {
        pending = { id: nextId++, parts: [], resolve };
        dc.send(JSON.stringify({ t: 'clip', id: pending.id, at }));
        const id = pending.id;
        setTimeout(() => { if (pending?.id === id) { pending.resolve(null); pending = null; } }, 60000);
      });
    },
  };
}

// ---------- גרף "מוניטור לב" ----------
export function drawGraph(canvas, g) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const c = canvas.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(document.documentElement);
  const col = (n, d) => css.getPropertyValue(n).trim() || d;
  const ok = col('--ok', '#34d399'), bad = col('--bad', '#fb7185'), moon = col('--moon', '#fcd34d'), muted = col('--muted', '#8d9ab3');
  const plotH = h - 18;
  const span = g.until - g.start;
  const x = (t) => ((t - g.start) / span) * w;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#060b14'; c.fillRect(0, 0, w, plotH);
  // רשת דקה כמו במוניטור
  c.strokeStyle = 'rgba(52,211,153,.08)'; c.lineWidth = 1;
  for (let gx = 0; gx < w; gx += 20) { c.beginPath(); c.moveTo(gx + 0.5, 0); c.lineTo(gx + 0.5, plotH); c.stroke(); }
  for (let gy = 0; gy < plotH; gy += 20) { c.beginPath(); c.moveTo(0, gy + 0.5); c.lineTo(w, gy + 0.5); c.stroke(); }
  // אזורים עם הקלטה
  (g.spans || []).forEach(([s, e, v]) => { c.fillStyle = v ? 'rgba(96,165,250,.16)' : 'rgba(148,163,184,.10)'; c.fillRect(x(s), plotH - 4, Math.max(1, x(e) - x(s)), 4); });
  // בכי
  (g.cries || []).forEach(([s, e]) => { c.fillStyle = 'rgba(251,113,133,.22)'; c.fillRect(x(s) - 1, 0, Math.max(3, x(e) - x(s) + 2), plotH - 4); });
  // קו העוצמה
  const data = g.data || [];
  c.lineWidth = 1.6; c.lineJoin = 'round';
  const perPx = Math.max(1, Math.floor(data.length / w));
  c.beginPath();
  let drawing = false;
  for (let i = 0; i < data.length; i += perPx) {
    let v = 255;
    for (let k = i; k < i + perPx && k < data.length; k++) if (data[k] !== 255 && (v === 255 || data[k] > v)) v = data[k];
    const px = x(g.start + i * g.step);
    if (v === 255) { drawing = false; continue; }
    const py = plotH - 6 - (v / 100) * (plotH - 10);
    if (!drawing) { c.moveTo(px, py); drawing = true; } else c.lineTo(px, py);
  }
  c.strokeStyle = ok; c.shadowColor = ok; c.shadowBlur = 6; c.stroke(); c.shadowBlur = 0;
  // קו הסף
  if (g.threshold != null) {
    const ty = plotH - 6 - (g.threshold / 100) * (plotH - 10);
    c.setLineDash([4, 4]); c.strokeStyle = 'rgba(252,211,77,.35)'; c.beginPath(); c.moveTo(0, ty); c.lineTo(w, ty); c.stroke(); c.setLineDash([]);
  }
  // הזמן שנבחר
  if (g.sel) { c.strokeStyle = moon; c.lineWidth = 2; c.beginPath(); c.moveTo(x(g.sel), 0); c.lineTo(x(g.sel), plotH); c.stroke(); }
  // שעות למטה
  c.fillStyle = muted; c.font = '11px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
  const tickMs = span <= HOUR ? 15 * 60000 : span <= 3 * HOUR ? 30 * 60000 : 2 * HOUR;
  for (let t = Math.ceil(g.start / tickMs) * tickMs; t < g.until; t += tickMs) {
    const tx = x(t);
    if (tx < 18 || tx > w - 18) continue;
    c.fillText(new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }), tx, h);
  }
  void bad;
}

export const b64 = {
  enc(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); },
  dec(s) { return Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0)); },
};
