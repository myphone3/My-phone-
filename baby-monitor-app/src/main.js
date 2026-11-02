import { createClient } from '@supabase/supabase-js';
import { registerPlugin, Capacitor } from '@capacitor/core';
import { LevelLog, Recorder, recordedSpans, storageInfo, sendClip, clipReceiver, drawGraph, b64, STEP, HOUR } from './history.js';

// ---------- הגדרות ----------
// כתובת ומפתח ציבוריים של Supabase של החנות (אותם ערכים שמופיעים באתר). אפשר לדרוס ב-VITE_*
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://iiaxizrezhczgutqijbe.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GlpxeLkaiEs9zbILs_oeUg_HU5xMKfu';
const TURN_URLS = (import.meta.env.VITE_TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);

const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    ...(TURN_URLS.length
      ? [{ urls: TURN_URLS, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }]
      : []),
  ],
};

const HEARTBEAT_MS = 5000; // מכשיר התינוק מדווח שהוא חי
const LOST_MS = 20000; // אחרי כמה זמן בלי דיווח ההורה מקבל התראה
const EPISODE_GAP_MS = 60000; // בכי שמתחיל אחרי דקה של שקט הוא בכי חדש (והתראה חדשה)
const MOTION_COOLDOWN_MS = 60000;
const RELAY_AFTER_MS = 12000; // אם השמע הישיר לא התחבר עד אז, עוברים לשמע דרך השרת
const RELAY_RATE = 8000; // איכות טלפון
const RELAY_CHUNK_MS = 500;

const native = Capacitor.isNativePlatform();
const Monitor = registerPlugin('Monitor');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { worker: true } });

const app = document.getElementById('app');
const live = document.getElementById('live');

const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch {} },
};
const rid = () => Math.random().toString(36).slice(2, 10);
const time = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const timeSec = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const $ = (sel) => app.querySelector(sel);
const $$ = (sel) => app.querySelectorAll(sel);

// טיימר שרץ ב-Worker, כדי שלא ייעצר כשהמסך כבוי
function ticker(ms, fn) {
  const w = new Worker(URL.createObjectURL(new Blob([`setInterval(()=>postMessage(0),${ms})`], { type: 'text/javascript' })));
  w.onmessage = fn;
  return () => w.terminate();
}

function levelFrom(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-8);
  return Math.max(0, Math.min(100, Math.round((db + 70) * (100 / 60))));
}

function setMeter(el, level, threshold) {
  if (!el) return;
  const bar = el.querySelector('i');
  bar.style.width = level + '%';
  bar.style.background = level > 70 ? 'var(--bad)' : level > 40 ? 'var(--moon)' : 'var(--ok)';
  const t = el.querySelector('s');
  if (t && threshold != null) t.style.left = threshold + '%';
}

async function nativeCall(name, args) {
  if (!native) return null;
  try { return await Monitor[name](args || {}); } catch (e) { console.warn(name, e); return null; }
}

function toast(text, onClick) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement(onClick ? 'button' : 'div');
  t.className = 'toast';
  t.textContent = text;
  if (onClick) t.onclick = () => { t.remove(); onClick(); };
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 8000);
}

// ---------- קידוד שמע לגיבוי דרך השרת (μ-law, 8kHz) ----------
function muEncode(x) {
  const s = Math.max(-1, Math.min(1, x)) * 32635;
  const sign = s < 0 ? 0x80 : 0;
  const v = Math.abs(s) + 132;
  let exp = 7;
  for (let mask = 0x4000; (v & mask) === 0 && exp > 0; exp--, mask >>= 1);
  const man = (v >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | man) & 0xff;
}
function muDecode(b) {
  b = ~b & 0xff;
  const sign = b & 0x80, exp = (b >> 4) & 7, man = b & 0x0f;
  const v = (((man << 3) + 132) << exp) - 132;
  return (sign ? -v : v) / 32768;
}

function channelFor(code) {
  return supabase.channel('bm-' + code, { config: { broadcast: { self: false, ack: false } } });
}

let teardown = () => {};
function go(view) {
  teardown();
  teardown = () => {};
  document.querySelectorAll('.toast,.dim').forEach((e) => e.remove());
  view();
}

function toggleRow(id, label, on, hint = '') {
  return `<label class="toggle" for="${id}"><span><b>${label}</b>${hint ? `<span class="muted small" style="display:block">${hint}</span>` : ''}</span>
    <input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
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
const SOUNDS = { none: 'כבוי', white: '🌊 רעש לבן', lullaby: '🎵 שיר ערש' };

function soundPlayer(ctx) {
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

// ---------- מסך פתיחה ----------
function home() {
  app.innerHTML = `
    <div class="hero">
      <div class="moon"></div>
      <h1>ביבי-מוניטור</h1>
      <p class="muted">שמים מכשיר אחד בחדר של התינוק ומחברים אליו את המכשירים של ההורים. שומעים ורואים בשידור חי, מקבלים התראה כשהתינוק בוכה, ואפשר לחזור אחורה בהקלטות.</p>
    </div>
    <button class="card pick" id="baby"><b>👶 מכשיר התינוק</b><span class="muted">נשאר בחדר, מקשיב, מצלם ומקליט</span></button>
    <button class="card pick alt" id="parent"><b>🎧 מכשיר הורה</b><span class="muted">אפשר לחבר כמה הורים לאותו תינוק</span></button>
    <ul class="tips">
      <li>האפליקציה ממשיכה לעבוד גם כשהמסך מוחשך.</li>
      <li>חברו את מכשיר התינוק למטען.</li>
      <li>שני המכשירים צריכים חיבור לאינטרנט, WiFi או סלולר.</li>
    </ul>`;
  $('#baby').onclick = () => go(baby);
  $('#parent').onclick = () => go(parent);
}

function batteryHint(container) {
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

async function deviceInfo() {
  const r = await nativeCall('deviceInfo');
  if (r) return r;
  try {
    const b = await navigator.getBattery?.();
    if (b) return { battery: Math.round(b.level * 100), charging: b.charging };
  } catch {}
  return {};
}

// ================= מכשיר התינוק =================
function baby() {
  let code = store.get('bm-code');
  if (!code) { code = String(Math.floor(1000 + Math.random() * 9000)); store.set('bm-code', code); }
  let sensitivity = +store.get('bm-sens', 60);
  let camWanted = store.get('bm-cam', '0') === '1';
  let facing = store.get('bm-facing', 'environment');
  let recOn = store.get('bm-rec', '1') === '1';
  let retention = +store.get('bm-ret', 3);

  app.innerHTML = `
    <div class="top"><h1>מכשיר התינוק</h1><button class="back" id="back">חזרה</button></div>
    <div class="card" style="text-align:center">
      <div class="muted small">קוד החיבור. הקלידו אותו בכל מכשיר הורה</div>
      <div class="code">${code}</div>
      <button class="back small" id="newcode">קוד חדש</button>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      ${toggleRow('cam', '📷 שידור מצלמה', camWanted, 'ההורים יכולים גם להדליק אותה מרחוק')}
      ${toggleRow('rec', '⏺️ הקלטה להיסטוריה', recOn, 'ההורים יכולים לחזור אחורה ולראות מה קרה')}
      <label class="row small" for="ret"><span>לשמור הקלטות של</span>
        <select id="ret">${[1, 3, 6, 12].map((h) => `<option value="${h}" ${h === retention ? 'selected' : ''}>${h} ${h === 1 ? 'שעה' : 'שעות'} אחרונות</option>`).join('')}</select></label>
      <div class="muted small" id="storage"></div>
    </div>
    <div id="body"></div>
    <div id="hints"></div>`;
  $('#back').onclick = () => go(home);
  $('#newcode').onclick = () => { store.set('bm-code', String(Math.floor(1000 + Math.random() * 9000))); go(baby); };
  $('#cam').onchange = (e) => { camWanted = e.target.checked; store.set('bm-cam', camWanted ? '1' : '0'); };
  $('#rec').onchange = (e) => { recOn = e.target.checked; store.set('bm-rec', recOn ? '1' : '0'); };
  $('#ret').onchange = (e) => { retention = +e.target.value; store.set('bm-ret', retention); };
  const showStorage = () => storageInfo().then((s) => {
    const el = $('#storage');
    if (el) el.textContent = s.count ? `שמורות הקלטות מ-${time(s.since)} · ${Math.round(s.bytes / 1048576)}MB` : 'אין עדיין הקלטות שמורות';
  });
  showStorage();

  $('#body').innerHTML = `<button class="btn" id="start">התחלה</button><div id="err"></div>`;
  $('#start').onclick = start;
  batteryHint($('#hints'));

  async function start() {
    $('#start').disabled = true;
    // מבקשים גם הרשאת מצלמה מראש, כדי שהורה יוכל להדליק אותה מרחוק
    const perms = await nativeCall('requestAll', { mode: 'baby', camera: true });
    const camAllowed = !perms || perms.camera;
    if (perms && !perms.microphone) {
      $('#err').innerHTML = '<div class="warn">בלי הרשאת מיקרופון אי אפשר להאזין. אשרו אותה בהגדרות האפליקציה.</div>';
      $('#start').disabled = false;
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch {
      $('#err').innerHTML = '<div class="warn">אין גישה למיקרופון. בדקו שההרשאה מאושרת ונסו שוב.</div>';
      $('#start').disabled = false;
      return;
    }
    const audioTrack = stream.getAudioTracks()[0];
    let videoTrack = null, torch = false, quietUntil = 0;

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const sound = soundPlayer(ctx);

    const peers = new Map(); // parentId -> { pc, video, videoSender, dc, talk }
    const relayListeners = new Map();
    const ch = channelFor(code);
    const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });

    const levels = new LevelLog();
    const recorder = recOn ? new Recorder(retention) : null;
    const mediaStream = () => new MediaStream([audioTrack, ...(videoTrack ? [videoTrack] : [])]);
    let lastDevice = {};

    // יומן בכי: [{s, e}]
    let log = [];
    try { log = JSON.parse(store.get('bm-log', '[]')).filter((x) => x.s > Date.now() - 7 * 24 * HOUR); } catch {}
    let episode = null;

    // ---- מצלמה ----
    async function openCamera() {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } },
        });
        videoTrack = vs.getVideoTracks()[0];
        videoTrack.contentHint = 'motion';
        torch = false;
        return true;
      } catch {
        return false;
      }
    }
    function closeCamera() { videoTrack?.stop(); videoTrack = null; torch = false; }
    const torchAvail = () => !!videoTrack?.getCapabilities?.().torch;
    async function setTorch(on) {
      if (!torchAvail()) return;
      try { await videoTrack.applyConstraints({ advanced: [{ torch: on }] }); torch = on; quietUntil = Date.now() + 4000; } catch {}
    }
    const serviceText = () => 'קוד ' + code + (videoTrack ? ' · מקשיב ומצלם' : ' · מקשיב לחדר התינוק');
    const updateService = () => nativeCall('start', { mode: 'baby', camera: camAllowed, title: 'ביבי-מוניטור פעיל', text: serviceText() });

    async function setCamera(on) {
      if (on && !camAllowed) return false;
      if (on && !videoTrack && !(await openCamera())) return false;
      if (!on) closeCamera();
      quietUntil = Date.now() + 4000;
      camWanted = !!videoTrack;
      store.set('bm-cam', camWanted ? '1' : '0');
      const cb = $('#cam'); if (cb) cb.checked = camWanted;
      renderRunning();
      updateService();
      recorder?.setStream(mediaStream());
      peers.forEach((p, pid) => connectParent(pid, p.video).catch(console.warn));
      sendStatus();
      return true;
    }

    if (camWanted && !(await openCamera())) {
      camWanted = false;
      $('#cam').checked = false;
      $('#err').innerHTML = '<div class="warn">אין גישה למצלמה. ממשיכים עם שמע בלבד.</div>';
    }
    await updateService();
    recorder?.start(mediaStream());

    $('#body').innerHTML = `
      <div class="card">
        <div class="row"><span id="what"></span><span id="parents" class="muted">ממתין למכשיר הורה</span></div>
        <div class="meter" id="meter"><i></i><s></s></div>
        <label class="small" style="display:block;margin-top:14px">רגישות לבכי: <span id="sv">${sensitivity}</span>
          <input type="range" id="sens" min="10" max="90" value="${sensitivity}"></label>
        <div class="muted small">הקו הצהוב הוא הסף. קול שעובר אותו לאורך כשנייה נחשב בכי ושולח התראה.</div>
        <div id="last" class="small" style="color:var(--bad);margin-top:8px"></div>
      </div>
      <div id="soundNow" class="card row" hidden><span id="soundTxt"></span><button class="back" id="soundStop">עצירה</button></div>
      <div id="camctl" class="row">
        <button class="btn dark" id="flip" style="flex:1">🔄 החלפת מצלמה</button>
        <button class="btn dark" id="torch" style="flex:1">🔦 פנס</button>
      </div>
      <button class="btn dark" id="dim">🌙 החשכת המסך (ממשיך לשדר)</button>
      <button class="btn line" id="stop">עצירה</button>`;
    $('#sens').oninput = (e) => { sensitivity = +e.target.value; $('#sv').textContent = sensitivity; store.set('bm-sens', sensitivity); };
    $('#stop').onclick = () => go(baby);
    $('#dim').onclick = dimScreen;
    $('#cam').onchange = async (e) => { if (!(await setCamera(e.target.checked))) { e.target.checked = false; toast('אין גישה למצלמה'); } };
    $('#rec').onchange = (e) => { recOn = e.target.checked; store.set('bm-rec', recOn ? '1' : '0'); toast('השינוי יחול בהפעלה הבאה'); };
    $('#ret').onchange = (e) => { retention = +e.target.value; store.set('bm-ret', retention); recorder?.setRetention(retention); };
    $('#flip').onclick = flipCamera;
    $('#torch').onclick = () => setTorch(!torch).then(() => { renderRunning(); sendStatus(); });
    $('#soundStop').onclick = () => { sound.stop(); renderRunning(); sendStatus(); };

    async function flipCamera() {
      if (!videoTrack) return;
      facing = facing === 'environment' ? 'user' : 'environment';
      store.set('bm-facing', facing);
      closeCamera();
      if (await openCamera()) {
        peers.forEach((p) => p.videoSender?.replaceTrack(p.video ? videoTrack : null));
        recorder?.setStream(mediaStream());
      }
      quietUntil = Date.now() + 4000;
      renderRunning(); sendStatus();
    }

    function renderRunning() {
      const w = $('#what');
      if (!w) return;
      w.innerHTML = `<span class="dot ok"></span>מאזין${videoTrack ? ' ומצלם' : ''}${recorder ? ' · ⏺️ מקליט' : ''}`;
      $('#camctl').hidden = !videoTrack;
      $('#torch').hidden = !torchAvail();
      $('#torch').textContent = torch ? '🔦 כיבוי פנס' : '🔦 פנס';
      const st = sound.state;
      $('#soundNow').hidden = st.type === 'none';
      $('#soundTxt').textContent = st.type === 'none' ? '' : `${SOUNDS[st.type]} מתנגן${st.until ? ' עד ' + time(st.until) : ''}`;
    }
    renderRunning();

    function dimScreen() {
      nativeCall('dim', { on: true });
      const d = document.createElement('button');
      d.className = 'dim';
      d.innerHTML = `<div>${videoTrack ? 'מאזין ומצלם' : 'מאזין'}… קוד ${code}</div><div class="small" style="margin-top:20px">הקישו להאיר את המסך</div>`;
      d.onclick = () => { nativeCall('dim', { on: false }); d.remove(); };
      document.body.appendChild(d);
    }

    const showParents = () => {
      const n = [...peers.values()].filter((p) => p.pc.connectionState === 'connected').length + relayListeners.size;
      const el = $('#parents');
      if (el) { el.textContent = n ? `${n} ${n === 1 ? 'הורה מחובר' : 'הורים מחוברים'}` : 'ממתין למכשיר הורה'; el.style.color = n ? 'var(--ok)' : ''; }
    };

    async function connectParent(pid, wantVideo) {
      const old = peers.get(pid);
      old?.pc.close(); old?.talk?.remove();
      const pc = new RTCPeerConnection(ICE);
      const peer = { pc, video: !!wantVideo, videoSender: null, dc: null, talk: null };
      peers.set(pid, peer);
      pc.addTrack(audioTrack, stream);
      if (videoTrack) {
        peer.videoSender = pc.addTrack(videoTrack, stream);
        if (!peer.video) peer.videoSender.replaceTrack(null);
        try {
          const params = peer.videoSender.getParameters();
          params.encodings = [{ ...(params.encodings?.[0] || {}), maxBitrate: 600000 }];
          await peer.videoSender.setParameters(params);
        } catch {}
      }
      // ערוץ נתונים להעברת הקלטות מההיסטוריה
      peer.dc = pc.createDataChannel('files', { ordered: true });
      peer.dc.onmessage = (e) => {
        try { const m = JSON.parse(e.data); if (m.t === 'clip') sendClip(peer.dc, m).catch(console.warn); } catch {}
      };
      // ההורה מדבר אל התינוק
      pc.ontrack = (e) => {
        if (e.track.kind !== 'audio') return;
        const a = document.createElement('audio');
        a.autoplay = true; a.srcObject = new MediaStream([e.track]);
        document.body.appendChild(a);
        a.play().catch(() => {});
        peer.talk = a;
      };
      pc.onicecandidate = (e) => e.candidate && send('ice', { to: pid, from: 'baby', candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState) && peers.get(pid)?.pc === pc) { peers.delete(pid); peer.talk?.remove(); }
        showParents();
      };
      await pc.setLocalDescription(await pc.createOffer());
      send('offer', { to: pid, sdp: pc.localDescription, video: !!videoTrack });
    }

    function statusPayload(extra = {}) {
      const st = sound.state;
      return {
        ts: Date.now(), video: !!videoTrack, camAllowed, torch, torchAvail: torchAvail(), facing,
        sound: { type: st.type, until: st.until, vol: st.vol }, rec: !!recorder, threshold: 100 - sensitivity,
        ...lastDevice, ...extra,
      };
    }
    const sendStatus = (extra) => send('status', statusPayload(extra));

    async function sendHistory(to, hours) {
      const until = Date.now(), since = until - Math.min(12, Math.max(1, hours)) * HOUR;
      await levels.flush();
      const data = await levels.range(since, until);
      const spans = await recordedSpans(since);
      const cries = log.filter((x) => x.e >= since).map((x) => [x.s, x.e]);
      send('hist', { to, start: since, until, step: STEP, d: b64.enc(data), spans, cries, threshold: 100 - sensitivity });
    }

    ch.on('broadcast', { event: 'hello' }, ({ payload }) => connectParent(payload.from, payload.video).catch(console.warn))
      .on('broadcast', { event: 'answer' }, ({ payload }) => peers.get(payload.from)?.pc.setRemoteDescription(payload.sdp).catch(console.warn))
      .on('broadcast', { event: 'ice' }, ({ payload }) => payload.to === 'baby' && peers.get(payload.from)?.pc.addIceCandidate(payload.candidate).catch(() => {}))
      .on('broadcast', { event: 'prefs' }, ({ payload }) => {
        const p = peers.get(payload.from);
        if (!p) return;
        p.video = !!payload.video;
        p.videoSender?.replaceTrack(p.video ? videoTrack : null);
      })
      .on('broadcast', { event: 'relay' }, ({ payload }) => {
        if (payload.on) relayListeners.set(payload.from, Date.now()); else relayListeners.delete(payload.from);
        showParents();
      })
      .on('broadcast', { event: 'hist-req' }, ({ payload }) => sendHistory(payload.from, payload.hours).catch(console.warn))
      .on('broadcast', { event: 'cmd' }, async ({ payload }) => {
        const a = payload.action;
        if (a === 'camera') { if (!(await setCamera(!!payload.on)) && payload.on) sendStatus({ camError: true }); }
        else if (a === 'flip') await flipCamera();
        else if (a === 'torch') { await setTorch(!!payload.on); renderRunning(); sendStatus(); }
        else if (a === 'sound') { sound.play(payload.type, payload.minutes, payload.vol ?? 0.5); renderRunning(); sendStatus(); }
      })
      .on('broadcast', { event: 'bye' }, ({ payload }) => {
        const p = peers.get(payload.from);
        p?.pc.close(); p?.talk?.remove(); peers.delete(payload.from); relayListeners.delete(payload.from); showParents();
      })
      .subscribe((s) => s === 'SUBSCRIBED' && send('baby-online', { ts: Date.now(), video: !!videoTrack }));

    // ---- שמע גיבוי דרך השרת: נשלח רק כשיש הורה שלא הצליח להתחבר ישירות ----
    const ratio = ctx.sampleRate / RELAY_RATE;
    const chunkLen = (RELAY_RATE * RELAY_CHUNK_MS) / 1000;
    let pcm = new Uint8Array(chunkLen), pcmPos = 0, seq = 0, frac = 0;
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const silent = ctx.createGain();
    silent.gain.value = 0;
    src.connect(proc); proc.connect(silent); silent.connect(ctx.destination);
    proc.onaudioprocess = (e) => {
      if (!relayListeners.size) { pcmPos = 0; return; }
      const input = e.inputBuffer.getChannelData(0);
      for (let i = frac; i < input.length; i += ratio) {
        pcm[pcmPos++] = muEncode(input[Math.floor(i)]);
        if (pcmPos === chunkLen) {
          send('pcm', { seq: seq++, rate: RELAY_RATE, d: b64.enc(pcm) });
          pcm = new Uint8Array(chunkLen); pcmPos = 0;
        }
        frac = i + ratio - input.length;
      }
    };

    // ---- זיהוי תנועה בתמונה ----
    const mv = document.createElement('video');
    mv.muted = true; mv.playsInline = true;
    const mc = document.createElement('canvas');
    mc.width = 32; mc.height = 24;
    const mctx = mc.getContext('2d', { willReadFrequently: true });
    let prevFrame = null, lastMotion = 0;
    function checkMotion(now) {
      if (!videoTrack) { prevFrame = null; return; }
      if (mv.srcObject?.getVideoTracks()[0] !== videoTrack) { mv.srcObject = new MediaStream([videoTrack]); mv.play().catch(() => {}); prevFrame = null; return; }
      if (mv.readyState < 2) return;
      mctx.drawImage(mv, 0, 0, 32, 24);
      const px = mctx.getImageData(0, 0, 32, 24).data;
      const gray = new Uint8Array(32 * 24);
      for (let i = 0; i < gray.length; i++) gray[i] = (px[i * 4] * 3 + px[i * 4 + 1] * 6 + px[i * 4 + 2]) / 10;
      if (prevFrame && now > quietUntil) {
        let changed = 0;
        for (let i = 0; i < gray.length; i++) if (Math.abs(gray[i] - prevFrame[i]) > 28) changed++;
        if (changed / gray.length > 0.06 && now - lastMotion > MOTION_COOLDOWN_MS) {
          lastMotion = now;
          send('motion', { ts: now });
        }
      }
      prevFrame = gray;
    }

    // ---- הלולאה הראשית ----
    const samples = [];
    let lastBeat = 0, lastFlush = Date.now(), lastPrune = 0, lastDevAt = 0, tickN = 0, logDirty = false;
    const saveLog = () => { store.set('bm-log', JSON.stringify(log)); logDirty = false; };
    const stopTick = ticker(100, () => {
      tickN++;
      if (ctx.state === 'suspended') ctx.resume();
      analyser.getFloatTimeDomainData(buf);
      const lv = levelFrom(buf);
      const now = Date.now();
      // כשמתנגן צליל הרגעה, הסף עולה כדי שהצליל עצמו לא ייחשב בכי
      const threshold = 100 - sensitivity + (sound.state.type !== 'none' ? 15 : 0);
      if (!document.hidden) setMeter($('#meter'), lv, threshold);
      levels.add(now, lv);
      samples.push(lv > threshold ? 1 : 0);
      if (samples.length > 20) samples.shift();
      const isCrying = samples.length === 20 && samples.reduce((a, b) => a + b, 0) / 20 > 0.45;
      if (isCrying) {
        if (!episode || now - episode.e > EPISODE_GAP_MS) {
          episode = { s: now, e: now };
          log.push(episode);
          send('cry', { ts: now, level: lv });
          const l = $('#last'); if (l) l.textContent = 'התראה אחרונה נשלחה ב-' + time(now);
        } else episode.e = now;
        logDirty = true;
      }
      if (tickN % 5 === 0) checkMotion(now);
      recorder?.tick();
      sound.tick();
      if (now - lastDevAt > 60000) { lastDevAt = now; deviceInfo().then((d) => { lastDevice = d; }); }
      if (now - lastBeat > HEARTBEAT_MS) {
        lastBeat = now;
        sendStatus({ crying: isCrying, level: lv });
        relayListeners.forEach((seen, pid) => now - seen > 30000 && relayListeners.delete(pid));
        if (sound.state.type === 'none' && $('#soundNow') && !$('#soundNow').hidden) renderRunning();
      }
      if (now - lastFlush > 30000) {
        lastFlush = now;
        levels.flush();
        if (logDirty) { log = log.filter((x) => x.s > now - 7 * 24 * HOUR); saveLog(); }
        if (now - lastPrune > 10 * 60000) { lastPrune = now; levels.prune(now - 24 * HOUR); showStorage(); }
      }
    });

    teardown = () => {
      stopTick();
      proc.onaudioprocess = null;
      send('baby-offline', {});
      peers.forEach((p) => { p.pc.close(); p.talk?.remove(); });
      supabase.removeChannel(ch);
      recorder?.stop();
      levels.flush();
      saveLog();
      sound.stop();
      stream.getTracks().forEach((t) => t.stop());
      closeCamera();
      ctx.close();
      nativeCall('dim', { on: false });
      nativeCall('stop');
    };
  }
}

// ================= מכשיר הורה =================
const ALERT_MODES = {
  ring: { label: '🔔 צליל', hint: 'התראה עם צליל ורטט, כמו הודעה בוואטסאפ' },
  vibrate: { label: '📳 רטט', hint: 'התראה ברטט, בלי צליל' },
  silent: { label: '🔕 שקט', hint: 'רק הודעה קופצת, בלי צליל ובלי רטט' },
};

function parent() {
  const me = rid(); // מזהה חדש לכל חיבור, כך שכמה הורים לא מתנגשים

  app.innerHTML = `
    <div class="top"><h1>מכשיר הורה</h1><button class="back" id="back">חזרה</button></div>
    <div id="body"></div><div id="hints"></div>`;
  $('#back').onclick = () => go(home);

  $('#body').innerHTML = `
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <label class="muted small" for="code">הקלידו את הקוד שמופיע במכשיר התינוק</label>
      <input id="code" class="code" inputmode="numeric" maxlength="4" placeholder="0000" value="${store.get('bm-parent-code', '')}">
      <button class="btn" id="connect">התחברות</button>
    </div>`;
  const inp = $('#code');
  const valid = () => /^\d{4}$/.test(inp.value);
  $('#connect').disabled = !valid();
  inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ''); $('#connect').disabled = !valid(); };
  $('#connect').onclick = () => valid() && connect(inp.value);
  batteryHint($('#hints'));

  async function connect(code) {
    store.set('bm-parent-code', code);
    await nativeCall('requestAll', { mode: 'parent' });
    await nativeCall('start', { mode: 'parent', title: 'ביבי-מוניטור מחובר', text: 'מקשיב לחדר התינוק · קוד ' + code });

    // הלחיצה מאפשרת ניגון שמע
    const actx = new AudioContext();
    actx.resume();
    live.play().catch(() => {});
    const analyser = actx.createAnalyser();
    analyser.fftSize = 2048;
    const buf = new Float32Array(analyser.fftSize);
    const relayGain = actx.createGain();
    relayGain.connect(actx.destination);

    let listen = store.get('bm-listen', '1') === '1';
    let watch = store.get('bm-watch', '1') === '1';
    let alertMode = store.get('bm-alert', 'ring');
    if (!ALERT_MODES[alertMode]) alertMode = 'ring';
    let motionAlerts = store.get('bm-motion', '0') === '1';
    const quiet = { on: store.get('bm-quiet', '0') === '1', from: store.get('bm-qfrom', '13:00'), to: store.get('bm-qto', '14:00') };
    let bright = false;
    let baby = { video: false, camAllowed: true, torch: false, torchAvail: false, sound: { type: 'none' }, rec: false };
    let babySeen = null, babyLevel = 0;
    let audioOn = false, relayOn = false, relayPing = 0, relayNext = 0;
    let lostNotified = false, lowBattNotified = false, prevCharging = null, pc = null, lastHello = 0, helloSince = 0;
    let micStream = null, talking = false;
    const clips = clipReceiver();
    let hist = null, histHours = 3, sel = null, histAsked = 0;

    const ch = channelFor(code);
    const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });
    const cmd = (action, extra = {}) => send('cmd', { from: me, action, ...extra });

    $('#body').innerHTML = `
      <div class="card">
        <div id="status"></div>
        <div class="meter" id="meter"><i></i></div>
        <div class="row muted small" style="margin-top:6px"><span>עוצמת הקול בחדר</span><span id="info"></span></div>
      </div>
      <div id="videoBox" class="video" hidden></div>
      <div class="vctl" id="vctl">
        <button id="camBtn"></button><button id="flipBtn" title="החלפת מצלמה">🔄</button><button id="torchBtn" title="פנס">🔦</button>
        <button id="brightBtn" title="הבהרת תמונה">🌗</button><button id="snapBtn" title="צילום">📸</button>
      </div>
      <div class="row">
        <button class="btn" id="listen" style="flex:2"></button>
        <button class="btn dark talk" id="talk" style="flex:1">🎙️ דברו</button>
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <div class="row"><b>📈 מה היה בחדר</b>
          <div class="seg small-seg" id="range">${[1, 3, 12].map((h) => `<button data-h="${h}">${h === 1 ? 'שעה' : h + ' שעות'}</button>`).join('')}</div></div>
        <canvas id="graph" class="graph"></canvas>
        <div class="muted small" id="histHint">הקישו על הגרף כדי לראות ולשמוע מה קרה באותו רגע. אדום = בכי.</div>
        <div id="player" class="video" hidden><video id="pv" playsinline controls></video></div>
        <div id="pctl" class="row" dir="ltr" hidden>
          <button class="btn dark" id="pPrev" style="flex:1">⏪ 30 שנ׳</button>
          <span id="pTime" class="muted small" style="flex:1;text-align:center"></span>
          <button class="btn dark" id="pNext" style="flex:1">30 שנ׳ ⏩</button>
        </div>
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <b>🎵 צלילי הרגעה בחדר</b>
        <div class="seg" id="sounds">${Object.entries(SOUNDS).map(([k, l]) => `<button data-s="${k}">${l}</button>`).join('')}</div>
        <div class="row small">
          <label for="sMin">לכמה זמן</label>
          <select id="sMin"><option value="15">15 דקות</option><option value="30" selected>30 דקות</option><option value="60">שעה</option><option value="0">בלי הגבלה</option></select>
        </div>
        <label class="small" for="sVol">עוצמה<input type="range" id="sVol" min="5" max="100" value="${store.get('bm-svol', 50)}"></label>
        <div class="muted small" id="soundState"></div>
      </div>

      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <b>התראות</b>
        <div class="seg" id="modes">${Object.entries(ALERT_MODES).map(([k, m]) => `<button data-mode="${k}">${m.label}</button>`).join('')}</div>
        <div class="muted small" id="modeHint"></div>
        ${toggleRow('motion', '👋 התראה על תנועה', motionAlerts, 'כשהמצלמה דולקת ויש תנועה בעריסה')}
        ${toggleRow('watch', '👁️ הצגת וידאו', watch, 'כיבוי חוסך גלישה וסוללה, השמע ממשיך')}
        ${toggleRow('quiet', '🌙 שעות שקטות', quiet.on, 'בשעות האלה ההתראות שקטות אוטומטית')}
        <div class="row small" id="quietTimes">
          <label>מ-<input type="time" id="qFrom" value="${quiet.from}"></label>
          <label>עד <input type="time" id="qTo" value="${quiet.to}"></label>
        </div>
      </div>
      <button class="btn dark" id="test">בדיקת התראה</button>
      <button class="btn line" id="disc">ניתוק</button>`;
    $('#videoBox').appendChild(live);

    // ---------- התראות ----------
    const inQuiet = () => {
      if (!quiet.on) return false;
      const m = (s) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };
      const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), a = m(quiet.from), b = m(quiet.to);
      return a <= b ? now >= a && now < b : now >= a || now < b;
    };
    const effectiveMode = () => (inQuiet() ? 'silent' : alertMode);
    function ding() {
      if (actx.state === 'suspended') actx.resume();
      [[880, 0], [1320, 0.12]].forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = f; o.type = 'sine';
        const t = actx.currentTime + d;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + 0.4);
      });
    }
    function notify(title, text, onClick) {
      const mode = effectiveMode();
      nativeCall('alert', { mode, title, text });
      if (!native) {
        if (mode === 'ring') ding();
        if (mode !== 'silent') { try { navigator.vibrate?.([300, 150, 300]); } catch {} }
      }
      toast(`${title} · ${text}`, onClick);
    }

    // ---------- תצוגה ----------
    const renderListen = () => {
      const b = $('#listen');
      b.className = 'btn ' + (listen ? 'ok' : 'dark');
      b.textContent = listen ? '🔊 שומעים את החדר' : '🔇 השמע החי מושתק';
      live.muted = !listen || talking;
      relayGain.gain.value = listen && !talking ? 1 : 0;
    };
    const renderModes = () => {
      $$('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === alertMode));
      $('#modeHint').textContent = ALERT_MODES[alertMode].hint + (inQuiet() ? ' · עכשיו שעות שקטות' : '');
      $('#quietTimes').hidden = !quiet.on;
    };
    function renderBaby() {
      $('#videoBox').hidden = !(watch && baby.video && audioOn);
      $('#camBtn').textContent = baby.video ? '📷 כיבוי מצלמה' : '📷 הדלקת מצלמה';
      $('#camBtn').classList.toggle('on', baby.video);
      $('#flipBtn').hidden = !baby.video;
      $('#torchBtn').hidden = !(baby.video && baby.torchAvail);
      $('#torchBtn').classList.toggle('on', !!baby.torch);
      $('#brightBtn').hidden = $('#snapBtn').hidden = !(baby.video && audioOn && watch);
      $('#brightBtn').classList.toggle('on', bright);
      $('#talk').disabled = !audioOn;
      const st = baby.sound || { type: 'none' };
      $$('#sounds button').forEach((b) => b.classList.toggle('on', b.dataset.s === st.type));
      $('#soundState').textContent = st.type && st.type !== 'none' ? `${SOUNDS[st.type]} מתנגן${st.until ? ' עד ' + time(st.until) : ''}` : 'לא מתנגן כלום';
      const info = [];
      if (baby.battery != null) info.push(`🔋 ${baby.battery}%${baby.charging ? '⚡' : ''}`);
      if (baby.temp != null) info.push(`🌡️ ${baby.temp}°`);
      $('#info').textContent = info.join(' · ');
    }
    function renderStatus() {
      const el = $('#status');
      if (!el) return;
      const now = Date.now();
      if (babySeen === null) {
        el.innerHTML = '<span class="dot wait"></span>מחפש את מכשיר התינוק… ודאו שלחצו שם על "התחלה"';
      } else if (now - babySeen > LOST_MS) {
        el.innerHTML = `<b style="color:var(--bad)"><span class="dot bad"></span>אין קשר עם מכשיר התינוק כבר ${Math.round((now - babySeen) / 1000)} שניות</b>`;
      } else {
        const how = audioOn ? (baby.video && watch ? 'שמע ווידאו חיים' : 'שמע חי') : relayOn ? 'שמע דרך השרת (איכות טלפון)' : 'שמע חי מתחבר…';
        el.innerHTML = `<div class="row"><span style="color:var(--ok)"><span class="dot ok"></span>מחובר לחדר התינוק</span>
          <span class="muted small">${how}</span></div>`;
      }
      renderBaby();
    }
    renderListen(); renderModes();

    // ---------- כפתורים ----------
    $('#listen').onclick = () => { listen = !listen; store.set('bm-listen', listen ? '1' : '0'); renderListen(); };
    $$('#modes button').forEach((b) => (b.onclick = () => { alertMode = b.dataset.mode; store.set('bm-alert', alertMode); renderModes(); }));
    $('#watch').onchange = (e) => { watch = e.target.checked; store.set('bm-watch', watch ? '1' : '0'); send('prefs', { from: me, video: watch }); renderStatus(); };
    $('#motion').onchange = (e) => { motionAlerts = e.target.checked; store.set('bm-motion', motionAlerts ? '1' : '0'); };
    $('#quiet').onchange = (e) => { quiet.on = e.target.checked; store.set('bm-quiet', quiet.on ? '1' : '0'); renderModes(); };
    $('#qFrom').onchange = (e) => { quiet.from = e.target.value; store.set('bm-qfrom', quiet.from); renderModes(); };
    $('#qTo').onchange = (e) => { quiet.to = e.target.value; store.set('bm-qto', quiet.to); renderModes(); };
    $('#test').onclick = () => notify('👶 בדיקה', 'כך תיראה התראה במצב ' + ALERT_MODES[effectiveMode()].label);
    $('#disc').onclick = () => go(parent);
    $('#camBtn').onclick = () => {
      if (!baby.video && !baby.camAllowed) { toast('במכשיר התינוק לא אושרה הרשאת מצלמה'); return; }
      cmd('camera', { on: !baby.video });
      if (!baby.video && !watch) { watch = true; $('#watch').checked = true; store.set('bm-watch', '1'); }
      toast(baby.video ? 'מכבה את המצלמה…' : 'מדליק את המצלמה…');
    };
    $('#flipBtn').onclick = () => cmd('flip');
    $('#torchBtn').onclick = () => cmd('torch', { on: !baby.torch });
    $('#brightBtn').onclick = () => {
      bright = !bright;
      const f = bright ? 'brightness(1.9) contrast(1.15)' : '';
      live.style.filter = f; $('#pv').style.filter = f;
      renderBaby();
    };
    $('#snapBtn').onclick = () => snapshot(live);
    $$('#sounds button').forEach((b) => (b.onclick = () => {
      const vol = +$('#sVol').value / 100;
      cmd('sound', { type: b.dataset.s, minutes: +$('#sMin').value, vol });
    }));
    $('#sVol').onchange = (e) => {
      store.set('bm-svol', e.target.value);
      const st = baby.sound;
      if (st?.type && st.type !== 'none') cmd('sound', { type: st.type, minutes: st.until ? Math.max(1, Math.round((st.until - Date.now()) / 60000)) : 0, vol: +e.target.value / 100 });
    };

    async function snapshot(video) {
      if (!video.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      const x = c.getContext('2d');
      if (bright) x.filter = 'brightness(1.9) contrast(1.15)';
      x.drawImage(video, 0, 0);
      const data = c.toDataURL('image/jpeg', 0.9).split(',')[1];
      if (!native) { toast('שמירת תמונה עובדת באפליקציה בטלפון'); return; }
      const ok = await Monitor.saveImage({ data, name: 'baby-' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg' }).then(() => true, () => false);
      toast(ok ? '📸 התמונה נשמרה בגלריה (תיקייה BabyMonitor)' : 'לא הצלחנו לשמור את התמונה');
    }

    // ---------- דיבור אל התינוק (לחיצה ארוכה) ----------
    const audioSender = () => pc?.getTransceivers().find((t) => t.receiver.track?.kind === 'audio')?.sender;
    async function talkStart(e) {
      e.preventDefault();
      if (!audioOn) { toast('דיבור עובד רק כשיש חיבור ישיר'); return; }
      if (!micStream) {
        await nativeCall('requestAll', { mode: 'parent', mic: true });
        try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
        catch { toast('צריך לאשר הרשאת מיקרופון כדי לדבר'); return; }
      }
      talking = true;
      audioSender()?.replaceTrack(micStream.getAudioTracks()[0]);
      $('#talk').classList.add('on'); $('#talk').textContent = '🎙️ מדברים…';
      renderListen();
    }
    function talkStop() {
      if (!talking) return;
      talking = false;
      audioSender()?.replaceTrack(null);
      const t = $('#talk');
      if (t) { t.classList.remove('on'); t.textContent = '🎙️ דברו'; renderListen(); }
    }
    $('#talk').addEventListener('pointerdown', talkStart);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => $('#talk').addEventListener(ev, talkStop));

    // ---------- היסטוריה ----------
    const graph = $('#graph');
    const redraw = () => hist && drawGraph(graph, { ...hist, sel });
    function askHistory() { histAsked = Date.now(); send('hist-req', { from: me, hours: histHours }); }
    $$('#range button').forEach((b) => (b.onclick = () => {
      histHours = +b.dataset.h;
      $$('#range button').forEach((x) => x.classList.toggle('on', x === b));
      askHistory();
    }));
    $(`#range button[data-h="${histHours}"]`).classList.add('on');
    graph.onclick = (e) => {
      if (!hist) return;
      const r = graph.getBoundingClientRect();
      // הזמן זורם משמאל לימין, כמו במוניטור
      const at = hist.start + ((e.clientX - r.left) / r.width) * (hist.until - hist.start);
      playAt(at - 5000);
    };
    window.addEventListener('resize', redraw);

    const pv = $('#pv');
    let playing = null; // {meta, url}
    async function playAt(at) {
      sel = at; redraw();
      if (!clips.ready) { $('#histHint').textContent = 'צפייה בהקלטות עובדת רק כשיש חיבור ישיר למכשיר התינוק.'; return; }
      $('#histHint').textContent = 'טוען הקלטה מ-' + timeSec(at) + '…';
      const clip = await clips.request(at).catch(() => null);
      if (!clip) { $('#histHint').textContent = 'אין הקלטה מהזמן הזה.'; return; }
      if (playing) URL.revokeObjectURL(playing.url);
      playing = { meta: clip.meta, url: URL.createObjectURL(clip.blob) };
      $('#player').hidden = false; $('#pctl').hidden = false;
      const offset = Math.max(0, (at - clip.meta.s) / 1000);
      pv.ontimeupdate = null;
      pv.onloadedmetadata = () => {
        // הקלטות WebM לא שומרות אורך; טריק שגורם לדפדפן לחשב אותו כדי שאפשר יהיה לקפוץ בתוכן
        if (pv.duration === Infinity) {
          pv.currentTime = 1e9;
          pv.ontimeupdate = () => { pv.ontimeupdate = updateTime; pv.currentTime = offset; pv.play().catch(() => {}); };
        } else { pv.currentTime = offset; pv.play().catch(() => {}); pv.ontimeupdate = updateTime; }
      };
      pv.src = playing.url;
      $('#histHint').textContent = clip.meta.v ? 'וידאו ושמע מההקלטה' : 'שמע מההקלטה (המצלמה הייתה כבויה)';
    }
    function updateTime() {
      if (!playing) return;
      sel = playing.meta.s + pv.currentTime * 1000;
      $('#pTime').textContent = timeSec(sel);
      redraw();
    }
    pv.onended = () => playing && playAt(playing.meta.e + 200);
    pv.onplay = () => { live.muted = true; relayGain.gain.value = 0; };
    pv.onpause = () => renderListen();
    $('#pPrev').onclick = () => playAt((sel || Date.now()) - 30000);
    $('#pNext').onclick = () => playAt((sel || Date.now()) + 30000);

    // ---------- חיבור ----------
    function hello() { lastHello = Date.now(); if (!helloSince) helloSince = lastHello; send('hello', { from: me, video: watch }); }
    function setRelay(on) {
      if (relayOn === on) return;
      relayOn = on;
      send('relay', { from: me, on });
      relayPing = Date.now();
      relayNext = 0;
      renderStatus();
    }

    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== me) return;
      baby.video = !!payload.video;
      pc?.close();
      const p = (pc = new RTCPeerConnection(ICE));
      p.ontrack = (e) => {
        if (live.srcObject !== e.streams[0]) live.srcObject = e.streams[0];
        live.play().catch(() => {});
        if (e.track.kind === 'audio') {
          try { actx.createMediaStreamSource(new MediaStream([e.track])).connect(analyser); } catch {}
        }
      };
      p.ondatachannel = (e) => clips.attach(e.channel);
      p.onicecandidate = (e) => e.candidate && send('ice', { to: 'baby', from: me, candidate: e.candidate.toJSON() });
      p.onconnectionstatechange = () => {
        if (p !== pc) return;
        audioOn = p.connectionState === 'connected';
        if (audioOn) { helloSince = 0; setRelay(false); }
        if (p.connectionState === 'failed') setTimeout(hello, 1000);
        renderStatus();
      };
      await p.setRemoteDescription(payload.sdp);
      // מאפשרים לשלוח קול בחזרה (כפתור "דברו")
      p.getTransceivers().forEach((t) => { if (t.receiver.track?.kind === 'audio') t.direction = 'sendrecv'; });
      await p.setLocalDescription(await p.createAnswer());
      send('answer', { from: me, sdp: p.localDescription });
      if (talking && micStream) audioSender()?.replaceTrack(micStream.getAudioTracks()[0]);
    })
      .on('broadcast', { event: 'ice' }, ({ payload }) => payload.to === me && pc?.addIceCandidate(payload.candidate).catch(() => {}))
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        babySeen = Date.now(); lostNotified = false;
        if (payload.level != null) babyLevel = payload.level;
        const hadVideo = baby.video;
        baby = { ...baby, ...payload };
        if (payload.camError) toast('לא הצלחנו להדליק את המצלמה במכשיר התינוק');
        if (hadVideo !== baby.video && audioOn) hello();
        // סוללה
        if (baby.battery != null) {
          if (baby.battery <= 20 && !baby.charging && !lowBattNotified) { lowBattNotified = true; notify('🔋 סוללה נמוכה', `במכשיר התינוק נשארו ${baby.battery}%`); }
          if (baby.battery > 30 || baby.charging) lowBattNotified = false;
        }
        if (prevCharging === true && baby.charging === false) notify('🔌 המטען התנתק', 'מכשיר התינוק כבר לא בטעינה');
        if (baby.charging != null) prevCharging = baby.charging;
        renderBaby();
      })
      .on('broadcast', { event: 'cry' }, ({ payload }) => {
        babySeen = Date.now();
        notify('👶 התינוק בוכה', 'התחיל ב-' + time(payload.ts) + ' · הקישו לצפייה', () => playAt(payload.ts - 10000));
        setTimeout(askHistory, 2000);
      })
      .on('broadcast', { event: 'motion' }, ({ payload }) => {
        if (motionAlerts) notify('👋 תנועה בחדר', time(payload.ts) + ' · הקישו לצפייה', () => playAt(payload.ts - 5000));
      })
      .on('broadcast', { event: 'hist' }, ({ payload }) => {
        if (payload.to !== me) return;
        hist = { start: payload.start, until: payload.until, step: payload.step, data: b64.dec(payload.d), spans: payload.spans, cries: payload.cries, threshold: payload.threshold };
        redraw();
      })
      .on('broadcast', { event: 'baby-online' }, ({ payload }) => { babySeen = Date.now(); baby.video = !!payload.video; hello(); askHistory(); })
      .on('broadcast', { event: 'baby-offline' }, () => { babySeen = null; audioOn = false; setRelay(false); renderStatus(); })
      .on('broadcast', { event: 'pcm' }, ({ payload }) => {
        if (!relayOn) return;
        const bytes = b64.dec(payload.d);
        const ab = actx.createBuffer(1, bytes.length, payload.rate);
        const data = ab.getChannelData(0);
        for (let i = 0; i < bytes.length; i++) data[i] = muDecode(bytes[i]);
        const s = actx.createBufferSource();
        s.buffer = ab;
        s.connect(relayGain);
        s.connect(analyser);
        const now = actx.currentTime;
        if (relayNext < now + 0.05 || relayNext > now + 2) relayNext = now + 0.4; // מאגר קטן נגד קפיצות ברשת
        s.start(relayNext);
        relayNext += ab.duration;
      })
      .subscribe((s) => { if (s === 'SUBSCRIBED') { hello(); askHistory(); } });

    let lastRender = 0;
    const stopTick = ticker(250, () => {
      const now = Date.now();
      if (!document.hidden) {
        if (audioOn || relayOn) { analyser.getFloatTimeDomainData(buf); setMeter($('#meter'), levelFrom(buf)); }
        else setMeter($('#meter'), babyLevel);
      }
      if (babySeen !== null && !audioOn) {
        // שמע ישיר לא מתחבר: ממשיכים לנסות, ובינתיים עוברים לשמע דרך השרת
        if (now - lastHello > 10000) hello();
        if (helloSince && now - helloSince > RELAY_AFTER_MS) setRelay(true);
      }
      if (relayOn && now - relayPing > 10000) { relayPing = now; send('relay', { from: me, on: true }); }
      if (babySeen !== null && now - babySeen > LOST_MS && !lostNotified) {
        lostNotified = true;
        notify('⚠️ הקשר עם מכשיר התינוק נותק', 'בדקו את מכשיר התינוק ואת החיבור לאינטרנט');
      }
      if (!document.hidden && babySeen !== null && now - histAsked > 60000) askHistory();
      if (now - lastRender > 1000) { lastRender = now; renderStatus(); if ($('#modeHint')) renderModes(); }
    });
    renderStatus();

    teardown = () => {
      stopTick();
      talkStop();
      micStream?.getTracks().forEach((t) => t.stop());
      send('bye', { from: me });
      pc?.close();
      supabase.removeChannel(ch);
      window.removeEventListener('resize', redraw);
      live.srcObject = null;
      live.style.filter = '';
      document.body.appendChild(live);
      if (playing) URL.revokeObjectURL(playing.url);
      actx.close();
      nativeCall('stop');
    };
  }
}

home();
