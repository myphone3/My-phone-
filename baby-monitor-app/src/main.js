import { createClient } from '@supabase/supabase-js';
import { registerPlugin, Capacitor } from '@capacitor/core';

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
const CRY_COOLDOWN_MS = 30000;
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
const $ = (sel) => app.querySelector(sel);

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

// ---------- קידוד שמע לגיבוי דרך השרת (μ-law, 8kHz) ----------
function muEncode(x) {
  const s = Math.max(-1, Math.min(1, x)) * 32635;
  const sign = s < 0 ? 0x80 : 0;
  let v = Math.abs(s) + 132;
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
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

function channelFor(code) {
  return supabase.channel('bm-' + code, { config: { broadcast: { self: false, ack: false } } });
}

let teardown = () => {};
function go(view) {
  teardown();
  teardown = () => {};
  view();
}

// ---------- מסך פתיחה ----------
function home() {
  app.innerHTML = `
    <div class="hero">
      <div class="moon"></div>
      <h1>ביבי-מוניטור</h1>
      <p class="muted">שמים מכשיר אחד בחדר של התינוק ומחברים אליו את המכשירים של ההורים. שומעים ורואים בשידור חי, ומקבלים התראה כשהתינוק בוכה.</p>
    </div>
    <button class="card pick" id="baby"><b>👶 מכשיר התינוק</b><span class="muted">נשאר בחדר, מקשיב ומצלם</span></button>
    <button class="card pick alt" id="parent"><b>🎧 מכשיר הורה</b><span class="muted">אפשר לחבר כמה הורים לאותו תינוק</span></button>
    <ul class="tips">
      <li>האפליקציה ממשיכה לעבוד גם כשהמסך מוחשך או כבוי.</li>
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

function toggleRow(id, label, on, hint = '') {
  return `<label class="toggle" for="${id}"><span><b>${label}</b>${hint ? `<span class="muted small" style="display:block">${hint}</span>` : ''}</span>
    <input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
}

// ---------- מכשיר התינוק ----------
function baby() {
  let code = store.get('bm-code');
  if (!code) { code = String(Math.floor(1000 + Math.random() * 9000)); store.set('bm-code', code); }
  let sensitivity = +store.get('bm-sens', 60);
  let camOn = store.get('bm-cam', '0') === '1';
  let facing = store.get('bm-facing', 'environment');

  app.innerHTML = `
    <div class="top"><h1>מכשיר התינוק</h1><button class="back" id="back">חזרה</button></div>
    <div class="card" style="text-align:center">
      <div class="muted small">קוד החיבור. הקלידו אותו בכל מכשיר הורה</div>
      <div class="code">${code}</div>
      <button class="back small" id="newcode">קוד חדש</button>
    </div>
    <div class="card">${toggleRow('cam', '📷 שידור מצלמה', camOn, 'ההורים יוכלו לראות את התינוק בשידור חי')}</div>
    <div id="body"></div>
    <div id="hints"></div>`;
  $('#back').onclick = () => go(home);
  $('#newcode').onclick = () => { store.set('bm-code', String(Math.floor(1000 + Math.random() * 9000))); go(baby); };
  $('#cam').onchange = (e) => { camOn = e.target.checked; store.set('bm-cam', camOn ? '1' : '0'); };

  $('#body').innerHTML = `<button class="btn" id="start">התחלת האזנה</button><div id="err"></div>`;
  $('#start').onclick = start;
  batteryHint($('#hints'));

  async function start() {
    $('#start').disabled = true;
    const perms = await nativeCall('requestAll', { mode: 'baby', camera: camOn });
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
    let videoTrack = null;

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const peers = new Map(); // parentId -> { pc, video }
    const relayListeners = new Map(); // parentId -> נראה לאחרונה
    const ch = channelFor(code);
    const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });

    // ---- מצלמה ----
    async function openCamera() {
      try {
        const vs = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 20 } },
        });
        videoTrack = vs.getVideoTracks()[0];
        videoTrack.contentHint = 'motion';
        return true;
      } catch {
        return false;
      }
    }
    function closeCamera() { videoTrack?.stop(); videoTrack = null; }
    if (camOn && !(await openCamera())) {
      camOn = false;
      $('#cam').checked = false;
      $('#err').innerHTML = '<div class="warn">אין גישה למצלמה. ממשיכים עם שמע בלבד.</div>';
    }
    const serviceText = () => 'קוד ' + code + (videoTrack ? ' · מקשיב ומצלם' : ' · מקשיב לחדר התינוק');
    await nativeCall('start', { mode: 'baby', camera: !!videoTrack, title: 'ביבי-מוניטור פעיל', text: serviceText() });

    $('#body').innerHTML = `
      <div class="card">
        <div class="row"><span><span class="dot ok"></span>מאזין${videoTrack ? ' ומצלם' : ''}</span><span id="parents" class="muted">ממתין למכשיר הורה</span></div>
        <div class="meter" id="meter"><i></i><s></s></div>
        <label class="small" style="display:block;margin-top:14px">רגישות לבכי: <span id="sv">${sensitivity}</span>
          <input type="range" id="sens" min="10" max="90" value="${sensitivity}"></label>
        <div class="muted small">הקו הצהוב הוא הסף. קול שעובר אותו לאורך כשנייה נחשב בכי ושולח התראה.</div>
        <div id="last" class="small" style="color:var(--bad);margin-top:8px"></div>
      </div>
      <div id="camctl" class="row" ${videoTrack ? '' : 'hidden'}>
        <button class="btn dark" id="flip" style="flex:1">🔄 החלפת מצלמה</button>
      </div>
      <button class="btn dark" id="dim">🌙 החשכת המסך (ממשיך לשדר)</button>
      <button class="btn line" id="stop">עצירה</button>`;
    $('#sens').oninput = (e) => { sensitivity = +e.target.value; $('#sv').textContent = sensitivity; store.set('bm-sens', sensitivity); };
    $('#stop').onclick = () => go(baby);
    $('#dim').onclick = dimScreen;

    // הפעלה/כיבוי מצלמה תוך כדי שידור
    $('#cam').onchange = async (e) => {
      camOn = e.target.checked;
      store.set('bm-cam', camOn ? '1' : '0');
      if (camOn) {
        await nativeCall('requestAll', { mode: 'baby', camera: true });
        if (!(await openCamera())) { camOn = false; e.target.checked = false; return; }
      } else closeCamera();
      $('#camctl').hidden = !videoTrack;
      await nativeCall('start', { mode: 'baby', camera: !!videoTrack, title: 'ביבי-מוניטור פעיל', text: serviceText() });
      peers.forEach((p, pid) => connectParent(pid, p.video).catch(console.warn));
    };
    $('#flip').onclick = async () => {
      facing = facing === 'environment' ? 'user' : 'environment';
      store.set('bm-facing', facing);
      closeCamera();
      if (await openCamera()) {
        peers.forEach((p) => p.videoSender?.replaceTrack(p.video ? videoTrack : null));
      }
    };

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
      peers.get(pid)?.pc.close();
      const pc = new RTCPeerConnection(ICE);
      const peer = { pc, video: !!wantVideo, videoSender: null };
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
      pc.onicecandidate = (e) => e.candidate && send('ice', { to: pid, from: 'baby', candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState) && peers.get(pid)?.pc === pc) peers.delete(pid);
        showParents();
      };
      await pc.setLocalDescription(await pc.createOffer());
      send('offer', { to: pid, sdp: pc.localDescription, video: !!videoTrack });
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
      .on('broadcast', { event: 'bye' }, ({ payload }) => {
        peers.get(payload.from)?.pc.close(); peers.delete(payload.from); relayListeners.delete(payload.from); showParents();
      })
      .subscribe((s) => s === 'SUBSCRIBED' && send('baby-online', { ts: Date.now(), video: !!videoTrack }));

    // ---- שמע גיבוי דרך השרת: נשלח רק כשיש הורה שלא הצליח להתחבר ישירות ----
    const ratio = ctx.sampleRate / RELAY_RATE;
    const chunkLen = (RELAY_RATE * RELAY_CHUNK_MS) / 1000;
    let pcm = new Uint8Array(chunkLen), pcmPos = 0, seq = 0, frac = 0;
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    proc.onaudioprocess = (e) => {
      if (!relayListeners.size) { pcmPos = 0; return; }
      const input = e.inputBuffer.getChannelData(0);
      for (let i = frac; i < input.length; i += ratio) {
        const a = Math.floor(i);
        pcm[pcmPos++] = muEncode(input[a]);
        if (pcmPos === chunkLen) {
          send('pcm', { seq: seq++, rate: RELAY_RATE, d: toB64(pcm) });
          pcm = new Uint8Array(chunkLen); pcmPos = 0;
        }
        frac = i + ratio - input.length;
      }
    };

    // זיהוי בכי: קול מעל הסף ברוב החלון של 2 השניות האחרונות
    const samples = [];
    let crying = false, lastAlert = 0, lastBeat = 0;
    const stopTick = ticker(100, () => {
      if (ctx.state === 'suspended') ctx.resume();
      analyser.getFloatTimeDomainData(buf);
      const lv = levelFrom(buf);
      const threshold = 100 - sensitivity;
      if (!document.hidden) setMeter($('#meter'), lv, threshold);
      samples.push(lv > threshold ? 1 : 0);
      if (samples.length > 20) samples.shift();
      const isCrying = samples.length === 20 && samples.reduce((a, b) => a + b, 0) / 20 > 0.45;
      const now = Date.now();
      if (isCrying && !crying && now - lastAlert > CRY_COOLDOWN_MS) {
        lastAlert = now;
        send('cry', { ts: now, level: lv });
        const l = $('#last'); if (l) l.textContent = 'התראה אחרונה נשלחה ב-' + time(now);
      }
      crying = isCrying;
      if (now - lastBeat > HEARTBEAT_MS) {
        lastBeat = now;
        send('status', { ts: now, crying, level: lv, video: !!videoTrack });
        relayListeners.forEach((seen, pid) => now - seen > 30000 && relayListeners.delete(pid));
      }
    });

    teardown = () => {
      stopTick();
      proc.onaudioprocess = null;
      send('baby-offline', {});
      peers.forEach((p) => p.pc.close());
      supabase.removeChannel(ch);
      stream.getTracks().forEach((t) => t.stop());
      closeCamera();
      ctx.close();
      document.querySelector('.dim')?.remove();
      nativeCall('dim', { on: false });
      nativeCall('stop');
    };
  }
}

// ---------- מכשיר הורה ----------
const ALERT_MODES = {
  ring: { label: '🔔 צלצול', hint: 'אזעקה, רטט ומסך מלא' },
  vibrate: { label: '📳 רטט', hint: 'רטט והודעה, בלי צליל' },
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
    let babySeen = null, babyLevel = 0, babyHasVideo = false;
    let audioOn = false, relayOn = false, relayPing = 0, relayNext = 0;
    let lostNotified = false, alarmTimer = null, pc = null, lastHello = 0, helloSince = 0;
    const history = [];

    const ch = channelFor(code);
    const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });

    $('#body').innerHTML = `
      <div class="card">
        <div id="status"></div>
        <div class="meter" id="meter"><i></i></div>
        <div class="muted small" style="margin-top:6px">עוצמת הקול בחדר התינוק</div>
      </div>
      <div id="videoBox" class="video" hidden></div>
      <button class="btn" id="listen"></button>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div><b>כשהתינוק בוכה</b></div>
        <div class="seg" id="modes">${Object.entries(ALERT_MODES).map(([k, m]) => `<button data-mode="${k}">${m.label}</button>`).join('')}</div>
        <div class="muted small" id="modeHint"></div>
        ${toggleRow('watch', '📷 הצגת וידאו', watch, 'כיבוי חוסך גלישה וסוללה, השמע ממשיך')}
      </div>
      <div class="card" id="histCard" hidden><b>בכי אחרון</b><div id="hist" class="small muted" style="margin-top:6px"></div></div>
      <button class="btn dark" id="test">בדיקת צליל ההתראה</button>
      <button class="btn line" id="disc">ניתוק</button>`;
    $('#videoBox').appendChild(live);

    const renderListen = () => {
      const b = $('#listen');
      b.className = 'btn ' + (listen ? 'ok' : 'dark');
      b.textContent = listen ? '🔊 שומעים את החדר. הקישו להשתקה' : '🔇 השמע החי מושתק';
      live.muted = !listen;
      relayGain.gain.value = listen ? 1 : 0;
    };
    const renderModes = () => {
      app.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === alertMode));
      $('#modeHint').textContent = ALERT_MODES[alertMode].hint;
    };
    const renderVideo = () => {
      const show = watch && babyHasVideo && audioOn;
      $('#videoBox').hidden = !show;
    };
    renderListen(); renderModes();
    $('#listen').onclick = () => { listen = !listen; store.set('bm-listen', listen ? '1' : '0'); renderListen(); };
    app.querySelectorAll('#modes button').forEach((b) => (b.onclick = () => {
      alertMode = b.dataset.mode; store.set('bm-alert', alertMode); renderModes();
      if (alertMode !== 'ring') stopAlarm();
    }));
    $('#watch').onchange = (e) => {
      watch = e.target.checked; store.set('bm-watch', watch ? '1' : '0');
      send('prefs', { from: me, video: watch });
      renderVideo();
    };
    $('#disc').onclick = () => go(parent);

    function beep() {
      if (actx.state === 'suspended') actx.resume();
      [0, 0.25, 0.5].forEach((d) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = 880;
        const t = actx.currentTime + d;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.7, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(actx.destination);
        o.start(t); o.stop(t + 0.22);
      });
    }
    const vibrate = () => { try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch {} };
    $('#test').onclick = () => { if (alertMode === 'ring') beep(); if (alertMode !== 'silent') vibrate(); toast('כך תיראה התראה במצב ' + ALERT_MODES[alertMode].label); };

    function stopAlarm() {
      clearInterval(alarmTimer); alarmTimer = null;
      document.querySelector('.alarm')?.remove();
    }

    function toast(text) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = text;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 6000);
    }

    function alarm(ts) {
      history.unshift(ts); history.length = Math.min(history.length, 10);
      $('#histCard').hidden = false;
      $('#hist').textContent = history.map(time).join(' · ');
      nativeCall('alert', { mode: alertMode, title: '👶 התינוק בוכה', text: 'התחיל ב-' + time(ts) });
      if (alertMode !== 'ring') {
        if (alertMode === 'vibrate') vibrate();
        toast('👶 בכי בחדר התינוק · ' + time(ts));
        return;
      }
      if (document.querySelector('.alarm')) return;
      const a = document.createElement('button');
      a.className = 'alarm';
      a.innerHTML = `<div style="font-size:4rem">👶</div><b>התינוק בוכה</b><div>${time(ts)}</div><div class="small" style="margin-top:20px;background:rgba(255,255,255,.2);padding:10px 20px;border-radius:999px">הקישו להשתקת ההתראה</div>`;
      a.onclick = stopAlarm;
      document.body.appendChild(a);
      beep(); vibrate();
      alarmTimer = setInterval(() => { beep(); vibrate(); }, 2000);
    }

    function renderStatus() {
      const el = $('#status');
      if (!el) return;
      const now = Date.now();
      if (babySeen === null) {
        el.innerHTML = '<span class="dot wait"></span>מחפש את מכשיר התינוק… ודאו שלחצו שם על "התחלת האזנה"';
      } else if (now - babySeen > LOST_MS) {
        el.innerHTML = `<b style="color:var(--bad)"><span class="dot bad"></span>אין קשר עם מכשיר התינוק כבר ${Math.round((now - babySeen) / 1000)} שניות</b>`;
      } else {
        const how = audioOn ? (babyHasVideo && watch ? 'שמע ווידאו חיים' : 'שמע חי') : relayOn ? 'שמע דרך השרת (איכות טלפון)' : 'שמע חי מתחבר…';
        el.innerHTML = `<div class="row"><span style="color:var(--ok)"><span class="dot ok"></span>מחובר לחדר התינוק</span>
          <span class="muted small">${how}</span></div>`;
      }
      renderVideo();
    }

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
      babyHasVideo = !!payload.video;
      pc?.close();
      const p = (pc = new RTCPeerConnection(ICE));
      p.ontrack = (e) => {
        if (live.srcObject !== e.streams[0]) live.srcObject = e.streams[0];
        live.play().catch(() => {});
        if (e.track.kind === 'audio') {
          try { actx.createMediaStreamSource(new MediaStream([e.track])).connect(analyser); } catch {}
        }
      };
      p.onicecandidate = (e) => e.candidate && send('ice', { to: 'baby', from: me, candidate: e.candidate.toJSON() });
      p.onconnectionstatechange = () => {
        if (p !== pc) return;
        audioOn = p.connectionState === 'connected';
        if (audioOn) { helloSince = 0; setRelay(false); }
        if (p.connectionState === 'failed') setTimeout(hello, 1000);
        renderStatus();
      };
      await p.setRemoteDescription(payload.sdp);
      await p.setLocalDescription(await p.createAnswer());
      send('answer', { from: me, sdp: p.localDescription });
    })
      .on('broadcast', { event: 'ice' }, ({ payload }) => payload.to === me && pc?.addIceCandidate(payload.candidate).catch(() => {}))
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        babySeen = Date.now(); lostNotified = false; babyLevel = payload.level ?? 0;
        if (babyHasVideo !== !!payload.video) { babyHasVideo = !!payload.video; if (audioOn) hello(); }
      })
      .on('broadcast', { event: 'cry' }, ({ payload }) => { babySeen = Date.now(); alarm(payload.ts); })
      .on('broadcast', { event: 'baby-online' }, ({ payload }) => { babySeen = Date.now(); babyHasVideo = !!payload.video; hello(); })
      .on('broadcast', { event: 'baby-offline' }, () => { babySeen = null; audioOn = false; setRelay(false); renderStatus(); })
      .on('broadcast', { event: 'pcm' }, ({ payload }) => {
        if (!relayOn) return;
        const bytes = fromB64(payload.d);
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
      .subscribe((s) => s === 'SUBSCRIBED' && hello());

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
      // מזכירים למכשיר התינוק שעדיין צריך שמע דרך השרת
      if (relayOn && now - relayPing > 10000) { relayPing = now; send('relay', { from: me, on: true }); }
      if (babySeen !== null && now - babySeen > LOST_MS && !lostNotified) {
        lostNotified = true;
        nativeCall('alert', { mode: alertMode === 'silent' ? 'silent' : 'ring', title: '⚠️ הקשר עם מכשיר התינוק נותק', text: 'בדקו את מכשיר התינוק ואת החיבור לאינטרנט' });
        if (alertMode === 'ring') beep();
        if (alertMode !== 'silent') vibrate();
      }
      if (now - lastRender > 1000) { lastRender = now; renderStatus(); }
    });
    renderStatus();

    teardown = () => {
      stopTick();
      stopAlarm();
      send('bye', { from: me });
      pc?.close();
      supabase.removeChannel(ch);
      live.srcObject = null;
      document.body.appendChild(live);
      actx.close();
      nativeCall('stop');
    };
  }
}

home();
