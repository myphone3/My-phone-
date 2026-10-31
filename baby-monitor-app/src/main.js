import { createClient } from '@supabase/supabase-js';
import { registerPlugin, Capacitor } from '@capacitor/core';

// ---------- הגדרות ----------
// כתובת ומפתח ציבוריים של Supabase של החנות (אותם ערכים שמופיעים באתר). אפשר לדרוס ב-VITE_*
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://iiaxizrezhczgutqijbe.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GlpxeLkaiEs9zbILs_oeUg_HU5xMKfu';
const TURN_URLS = (import.meta.env.VITE_TURN_URLS || '').split(',').map((s) => s.trim()).filter(Boolean);

const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ...(TURN_URLS.length
      ? [{ urls: TURN_URLS, username: import.meta.env.VITE_TURN_USERNAME, credential: import.meta.env.VITE_TURN_CREDENTIAL }]
      : []),
  ],
};

const HEARTBEAT_MS = 5000; // מכשיר התינוק מדווח שהוא חי
const LOST_MS = 20000; // אחרי כמה זמן בלי דיווח ההורה מקבל התראה
const CRY_COOLDOWN_MS = 30000;

const native = Capacitor.isNativePlatform();
const Monitor = registerPlugin('Monitor');
const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { worker: true } }) : null;

const app = document.getElementById('app');
const live = document.getElementById('live');

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
const rid = () => Math.random().toString(36).slice(2, 10);
const time = (ts) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
const $ = (sel) => app.querySelector(sel);

// טיימר שרץ ב-Worker, כדי שלא ייעצר כשהמסך כבוי
function ticker(ms, fn) {
  const src = `setInterval(()=>postMessage(0),${ms})`;
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
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
      <p class="muted">שמים מכשיר אחד בחדר של התינוק ומחברים אליו את המכשירים של ההורים. כשהתינוק בוכה, שומעים מיד.</p>
    </div>
    ${supabase ? '' : '<div class="warn">חסרות הגדרות חיבור לשרת (Supabase). צריך לבנות את האפליקציה מחדש עם ההגדרות.</div>'}
    <button class="card pick" id="baby"><b>👶 מכשיר התינוק</b><span class="muted">נשאר בחדר ומקשיב</span></button>
    <button class="card pick alt" id="parent"><b>🎧 מכשיר הורה</b><span class="muted">אפשר לחבר כמה הורים לאותו תינוק</span></button>
    <ul class="tips">
      <li>האפליקציה ממשיכה לעבוד גם כשהמסך כבוי.</li>
      <li>חברו את מכשיר התינוק למטען.</li>
      <li>שני המכשירים צריכים חיבור לאינטרנט, WiFi או סלולר.</li>
    </ul>`;
  $('#baby').onclick = () => supabase && go(baby);
  $('#parent').onclick = () => supabase && go(parent);
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

// ---------- מכשיר התינוק ----------
function baby() {
  let code = store.get('bm-code');
  if (!code) { code = String(Math.floor(1000 + Math.random() * 9000)); store.set('bm-code', code); }
  let sensitivity = +(store.get('bm-sens') || 60);

  app.innerHTML = `
    <div class="top"><h1>מכשיר התינוק</h1><button class="back" id="back">חזרה</button></div>
    <div class="card" style="text-align:center">
      <div class="muted small">קוד החיבור. הקלידו אותו בכל מכשיר הורה</div>
      <div class="code">${code}</div>
      <button class="back small" id="newcode">קוד חדש</button>
    </div>
    <div id="body"></div>
    <div id="hints"></div>`;
  $('#back').onclick = () => go(home);
  $('#newcode').onclick = () => { store.set('bm-code', String(Math.floor(1000 + Math.random() * 9000))); go(baby); };

  const idle = () => {
    $('#body').innerHTML = `<button class="btn" id="start">התחלת האזנה</button><div id="err"></div>`;
    $('#start').onclick = start;
  };
  idle();
  batteryHint($('#hints'));

  async function start() {
    $('#start').disabled = true;
    const perms = await nativeCall('requestAll', { mode: 'baby' });
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
    await nativeCall('start', { mode: 'baby', title: 'ביבי-מוניטור מאזין', text: 'קוד ' + code + ' · מקשיב לחדר התינוק' });

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const peers = new Map(); // parentId -> RTCPeerConnection
    const ch = channelFor(code);
    const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });

    $('#body').innerHTML = `
      <div class="card">
        <div class="row"><span><span class="dot ok"></span>מאזין</span><span id="parents" class="muted">ממתין למכשיר הורה</span></div>
        <div class="meter" id="meter"><i></i><s></s></div>
        <label class="small" style="display:block;margin-top:14px">רגישות: <span id="sv">${sensitivity}</span>
          <input type="range" id="sens" min="10" max="90" value="${sensitivity}"></label>
        <div class="muted small">הקו הצהוב הוא הסף. קול שעובר אותו לאורך כשנייה נחשב בכי ושולח התראה.</div>
        <div id="last" class="small" style="color:var(--bad);margin-top:8px"></div>
      </div>
      <button class="btn dark" id="dim">החשכת המסך</button>
      <button class="btn line" id="stop">עצירת האזנה</button>`;
    $('#sens').oninput = (e) => { sensitivity = +e.target.value; $('#sv').textContent = sensitivity; store.set('bm-sens', sensitivity); };
    $('#stop').onclick = () => go(baby);
    $('#dim').onclick = () => {
      const d = document.createElement('button');
      d.className = 'dim';
      d.innerHTML = `<div>מאזין… קוד ${code}</div><div class="small" style="margin-top:20px">הקישו להאיר את המסך</div>`;
      d.onclick = () => d.remove();
      document.body.appendChild(d);
    };

    const showParents = () => {
      const n = [...peers.values()].filter((p) => p.connectionState === 'connected').length;
      const el = $('#parents');
      if (el) { el.textContent = n ? `${n} ${n === 1 ? 'הורה מחובר' : 'הורים מחוברים'}` : 'ממתין למכשיר הורה'; el.style.color = n ? 'var(--ok)' : ''; }
    };

    async function connectParent(pid) {
      peers.get(pid)?.close();
      const pc = new RTCPeerConnection(ICE);
      peers.set(pid, pc);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => e.candidate && send('ice', { to: pid, from: 'baby', candidate: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState) && peers.get(pid) === pc) peers.delete(pid);
        showParents();
      };
      await pc.setLocalDescription(await pc.createOffer());
      send('offer', { to: pid, sdp: pc.localDescription });
    }

    ch.on('broadcast', { event: 'hello' }, ({ payload }) => connectParent(payload.from).catch(console.warn))
      .on('broadcast', { event: 'answer' }, ({ payload }) => peers.get(payload.from)?.setRemoteDescription(payload.sdp).catch(console.warn))
      .on('broadcast', { event: 'ice' }, ({ payload }) => payload.to === 'baby' && peers.get(payload.from)?.addIceCandidate(payload.candidate).catch(() => {}))
      .on('broadcast', { event: 'bye' }, ({ payload }) => { peers.get(payload.from)?.close(); peers.delete(payload.from); showParents(); })
      .subscribe((s) => s === 'SUBSCRIBED' && send('baby-online', { ts: Date.now() }));

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
      if (now - lastBeat > HEARTBEAT_MS) { lastBeat = now; send('status', { ts: now, crying }); }
    });

    teardown = () => {
      stopTick();
      send('baby-offline', {});
      peers.forEach((p) => p.close());
      supabase.removeChannel(ch);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      nativeCall('stop');
    };
  }
}

// ---------- מכשיר הורה ----------
function parent() {
  const me = rid(); // מזהה חדש לכל חיבור, כך שכמה הורים לא מתנגשים

  app.innerHTML = `
    <div class="top"><h1>מכשיר הורה</h1><button class="back" id="back">חזרה</button></div>
    <div id="body"></div><div id="hints"></div>`;
  $('#back').onclick = () => go(home);

  $('#body').innerHTML = `
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <label class="muted small" for="code">הקלידו את הקוד שמופיע במכשיר התינוק</label>
      <input id="code" class="code" inputmode="numeric" maxlength="4" placeholder="0000" value="${store.get('bm-parent-code') || ''}">
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
    let analysed = null;

    let listen = store.get('bm-listen') !== '0';
    live.muted = !listen;
    let babySeen = null, audioOn = false, lostNotified = false, alarmTimer = null, pc = null, lastHello = 0;

    const ch = channelFor(code);
    const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });

    $('#body').innerHTML = `
      <div class="card">
        <div id="status"></div>
        <div class="meter" id="meter"><i></i></div>
        <div class="muted small" style="margin-top:6px">עוצמת הקול בחדר התינוק</div>
      </div>
      <button class="btn" id="listen"></button>
      <button class="btn dark" id="test">בדיקת צליל ההתראה</button>
      <button class="btn line" id="disc">ניתוק</button>`;

    const renderListen = () => {
      const b = $('#listen');
      b.className = 'btn ' + (listen ? 'ok' : 'dark');
      b.textContent = listen ? '🔊 שומעים את החדר. הקישו להשתקה' : '🔇 השמע מושתק. מקבלים רק התראות בכי';
    };
    renderListen();
    $('#listen').onclick = () => { listen = !listen; live.muted = !listen; store.set('bm-listen', listen ? '1' : '0'); renderListen(); };
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
      try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch {}
    }
    $('#test').onclick = beep;

    function alarm(ts) {
      nativeCall('alert', { title: '👶 התינוק בוכה', text: 'התחיל ב-' + time(ts) });
      if (document.querySelector('.alarm')) return;
      const a = document.createElement('button');
      a.className = 'alarm';
      a.innerHTML = `<div style="font-size:4rem">👶</div><b>התינוק בוכה</b><div>${time(ts)}</div><div class="small" style="margin-top:20px;background:rgba(255,255,255,.2);padding:10px 20px;border-radius:999px">הקישו להשתקת ההתראה</div>`;
      a.onclick = () => { clearInterval(alarmTimer); alarmTimer = null; a.remove(); };
      document.body.appendChild(a);
      beep();
      alarmTimer = setInterval(beep, 2000);
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
        el.innerHTML = `<div class="row"><span style="color:var(--ok)"><span class="dot ok"></span>מחובר לחדר התינוק</span>
          <span class="muted small">${audioOn ? 'שמע חי פעיל' : 'שמע חי מתחבר… ההתראות פעילות'}</span></div>`;
      }
    }

    function hello() { lastHello = Date.now(); send('hello', { from: me }); }

    ch.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      if (payload.to !== me) return;
      pc?.close();
      const p = (pc = new RTCPeerConnection(ICE));
      p.ontrack = (e) => {
        live.srcObject = e.streams[0];
        live.play().catch(() => {});
        try { analysed = actx.createMediaStreamSource(e.streams[0]); analysed.connect(analyser); } catch {}
      };
      p.onicecandidate = (e) => e.candidate && send('ice', { to: 'baby', from: me, candidate: e.candidate.toJSON() });
      p.onconnectionstatechange = () => { if (p === pc) { audioOn = p.connectionState === 'connected'; renderStatus(); } };
      await p.setRemoteDescription(payload.sdp);
      await p.setLocalDescription(await p.createAnswer());
      send('answer', { from: me, sdp: p.localDescription });
    })
      .on('broadcast', { event: 'ice' }, ({ payload }) => payload.to === me && pc?.addIceCandidate(payload.candidate).catch(() => {}))
      .on('broadcast', { event: 'status' }, () => { babySeen = Date.now(); lostNotified = false; })
      .on('broadcast', { event: 'cry' }, ({ payload }) => { babySeen = Date.now(); alarm(payload.ts); })
      .on('broadcast', { event: 'baby-online' }, () => { babySeen = Date.now(); hello(); })
      .on('broadcast', { event: 'baby-offline' }, () => { babySeen = null; audioOn = false; renderStatus(); })
      .subscribe((s) => s === 'SUBSCRIBED' && hello());

    const stopTick = ticker(250, () => {
      const now = Date.now();
      if (audioOn && !document.hidden) { analyser.getFloatTimeDomainData(buf); setMeter($('#meter'), levelFrom(buf)); }
      // מנסים שוב לחבר שמע חי אם הוא לא מחובר
      if (!audioOn && babySeen !== null && now - lastHello > 10000) hello();
      if (babySeen !== null && now - babySeen > LOST_MS && !lostNotified) {
        lostNotified = true;
        nativeCall('alert', { title: '⚠️ הקשר עם מכשיר התינוק נותק', text: 'בדקו את מכשיר התינוק ואת החיבור לאינטרנט' });
        beep();
      }
      if (now % 1000 < 250) renderStatus();
    });
    renderStatus();

    teardown = () => {
      stopTick();
      clearInterval(alarmTimer);
      document.querySelector('.alarm')?.remove();
      send('bye', { from: me });
      pc?.close();
      supabase.removeChannel(ch);
      live.srcObject = null;
      actx.close();
      nativeCall('stop');
    };
  }
}

home();
