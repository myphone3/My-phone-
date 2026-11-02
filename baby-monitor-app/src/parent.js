import jsQR from 'jsqr';
import {
  ICE, LOST_MS, RELAY_AFTER_MS, native, Monitor, supabase, store, rid, time, timeSec, dayTime, esc, $, $$, app, toast,
  ticker, levelFrom, setMeter, nativeCall, muDecode, channelFor, views, go, setTeardown, toggleRow, batteryHint,
  blobToBase64, SOUNDS,
} from './common.js';
import { clipReceiver, drawGraph, b64 } from './history.js';

const ALERT_MODES = {
  ring: { label: '🔔 צליל', hint: 'התראה עם צליל ורטט, כמו הודעה בוואטסאפ' },
  vibrate: { label: '📳 רטט', hint: 'התראה ברטט, בלי צליל' },
  silent: { label: '💬 הודעה', hint: 'רק הודעה קופצת, בלי צליל ובלי רטט' },
  off: { label: '🚫 כבוי', hint: 'בלי שום התראה בטלפון. הכל נרשם בלשונית "אירועים" ורואים כשנכנסים לאפליקציה' },
};
const ICONS = { cry: '👶', motion: '👋', battery: '🔋', charger: '🔌', lost: '⚠️', summary: '🌅', test: '🔔' };

const fmtDur = (sec) => (sec < 60 ? `${sec} שניות` : `${Math.round(sec / 60)} דקות`);

function loadRooms() {
  let r = store.json('bm-rooms', null);
  if (!Array.isArray(r)) {
    const c = store.get('bm-parent-code');
    r = c ? [{ code: c, name: 'התינוק' }] : [];
    store.setJson('bm-rooms', r);
  }
  return r;
}
const saveRooms = (r) => store.setJson('bm-rooms', r);

// ---------- יומן אירועים (נשמר בטלפון של ההורה) ----------
const events = {
  list: store.json('bm-events', []),
  listeners: new Set(),
  add(e) {
    this.list.unshift({ ts: Date.now(), ...e });
    this.list.length = Math.min(this.list.length, 200);
    store.setJson('bm-events', this.list);
    this.listeners.forEach((f) => f());
  },
  clear() { this.list = []; store.setJson('bm-events', []); this.listeners.forEach((f) => f()); },
};

views.parent = function parent(opts = {}) {
  const rooms = loadRooms();
  if (!rooms.length || opts.add) addRoom(rooms);
  else main(rooms);
};

// ================= הוספת חדר (הקלדה או סריקת QR) =================
function addRoom(rooms) {
  app.innerHTML = `
    <div class="top"><h1>${rooms.length ? 'הוספת חדר' : 'מכשיר הורה'}</h1><button class="back" id="back">חזרה</button></div>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <button class="btn" id="scan">📷 סריקת הקוד ממכשיר התינוק</button>
      <div id="scanBox" class="video" hidden><video id="scanVideo" playsinline muted></video></div>
      <div class="muted small" style="text-align:center">או הקלידו את המספר שמופיע שם</div>
      <input id="code" class="code" inputmode="numeric" maxlength="6" placeholder="000000">
      <label class="small" for="name">שם לחדר (למשל: נועה, חדר ילדים)</label>
      <input id="name" class="text" maxlength="20" placeholder="${rooms.length ? 'חדר ' + (rooms.length + 1) : 'התינוק'}">
      <button class="btn ok" id="add">${rooms.length ? 'הוספה' : 'התחברות'}</button>
    </div>
    <div id="hints"></div>`;
  let stopScan = () => {};
  setTeardown(() => stopScan());
  $('#back').onclick = () => go(rooms.length ? 'parent' : 'home');
  const inp = $('#code');
  const valid = () => /^\d{4,6}$/.test(inp.value);
  $('#add').disabled = !valid();
  inp.oninput = () => { inp.value = inp.value.replace(/\D/g, ''); $('#add').disabled = !valid(); };
  $('#add').onclick = () => {
    if (!valid()) return;
    if (rooms.some((r) => r.code === inp.value)) { toast('החדר הזה כבר ברשימה'); return; }
    rooms.push({ code: inp.value, name: $('#name').value.trim() || $('#name').placeholder });
    saveRooms(rooms);
    go('parent');
  };
  $('#scan').onclick = async () => {
    await nativeCall('requestAll', { mode: 'parent', camera: true });
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
    catch { toast('צריך לאשר הרשאת מצלמה כדי לסרוק'); return; }
    const v = $('#scanVideo');
    v.srcObject = stream; v.play().catch(() => {});
    $('#scanBox').hidden = false; $('#scan').hidden = true;
    const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
    const timer = setInterval(() => {
      if (v.readyState < 2) return;
      const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
      c.width = w; c.height = h;
      x.drawImage(v, 0, 0, w, h);
      const r = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      const m = r?.data?.match(/^BM:(\d{4,6})$/);
      if (m) {
        stopScan();
        inp.value = m[1]; inp.oninput();
        toast('✅ הקוד נסרק');
        $('#name').focus();
      }
    }, 250);
    stopScan = () => { clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); const b = $('#scanBox'); if (b) b.hidden = true; const s = $('#scan'); if (s) s.hidden = false; };
  };
  batteryHint($('#hints'));
}

// ================= המסך הראשי: לשוניות לכל חדר + אירועים + הגדרות =================
async function main(rooms) {
  const S = {
    alertMode: ALERT_MODES[store.get('bm-alert')] ? store.get('bm-alert') : 'ring',
    motion: store.get('bm-motion', '0') === '1',
    quiet: { on: store.get('bm-quiet', '0') === '1', from: store.get('bm-qfrom', '13:00'), to: store.get('bm-qto', '14:00') },
    morning: { on: store.get('bm-morning', '1') === '1', at: store.get('bm-mtime', '07:00') },
  };
  const multi = rooms.length > 1;
  app.innerHTML = `
    <div class="top"><h1>מכשיר הורה</h1><button class="back" id="back">ניתוק</button></div>
    <div class="tabs" id="tabs">
      ${rooms.map((r, i) => `<button data-tab="r${i}">👶 ${esc(r.name)}</button>`).join('')}
      <button data-tab="events">🗒️ אירועים <span class="badge" id="badge" hidden></span></button>
      <button data-tab="settings">⚙️</button>
    </div>
    <div id="panes">
      ${rooms.map((r, i) => `<div class="pane" id="pane-r${i}" hidden></div>`).join('')}
      <div class="pane" id="pane-events" hidden></div>
      <div class="pane" id="pane-settings" hidden></div>
    </div>`;
  $('#back').onclick = () => { store.del('bm-autostart'); go('home'); };
  store.set('bm-autostart', 'parent');

  const actx = new AudioContext();
  actx.resume();
  await nativeCall('requestAll', { mode: 'parent' });
  nativeCall('start', { mode: 'parent', title: 'ביבי-מוניטור מחובר', text: multi ? `מחובר ל-${rooms.length} חדרים` : 'מקשיב לחדר של ' + rooms[0].name });

  // ---------- התראות ----------
  const inQuiet = () => {
    if (!S.quiet.on) return false;
    const m = (s) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), a = m(S.quiet.from), b = m(S.quiet.to);
    return a <= b ? now >= a && now < b : now >= a || now < b;
  };
  const effectiveMode = () => (S.alertMode === 'off' ? 'off' : inQuiet() ? 'silent' : S.alertMode);
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
  // כל אירוע נרשם ביומן; התראה בטלפון רק לפי המצב שנבחר
  function notify(room, kind, title, text, at) {
    events.add({ room: room.name, code: room.code, kind, title, text, at });
    const mode = effectiveMode();
    if (mode === 'off') return;
    const t = multi ? `${title} · ${room.name}` : title;
    nativeCall('alert', { mode, title: t, text });
    if (!native) {
      if (mode === 'ring') ding();
      if (mode !== 'silent') { try { navigator.vibrate?.([300, 150, 300]); } catch {} }
    }
    toast(`${t} · ${text}`, at ? () => showRoom(room.code, at) : null);
  }

  const shared = { actx, S, notify, multi };
  const conns = rooms.map((room, i) => connectRoom(room, $('#pane-r' + i), shared));

  // ---------- לשוניות ----------
  let current = null;
  function showTab(key) {
    current = key;
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === key));
    $$('#panes > .pane').forEach((p) => { p.hidden = p.id !== 'pane-' + key; });
    if (key === 'events') { store.set('bm-events-seen', Date.now()); renderEvents(); }
    if (key.startsWith('r')) conns[+key.slice(1)]?.onShow();
    renderBadge();
  }
  function showRoom(code, at) {
    const i = rooms.findIndex((r) => r.code === code);
    if (i < 0) return;
    showTab('r' + i);
    if (at) conns[i].playAt(at);
  }
  $$('#tabs button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  // ---------- אירועים ----------
  function renderBadge() {
    const seen = +store.get('bm-events-seen', 0);
    const n = current === 'events' ? 0 : events.list.filter((e) => e.ts > seen).length;
    const b = $('#badge');
    if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; }
  }
  function renderEvents() {
    const p = $('#pane-events');
    if (!p) return;
    const seen = +store.get('bm-events-seen-prev', 0);
    p.innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;gap:4px">
        <div class="row"><b>מה קרה לאחרונה</b>${events.list.length ? '<button class="back small" id="clearEv">ניקוי</button>' : ''}</div>
        ${events.list.length ? `<ul class="events">${events.list.map((e, i) => `
          <li class="${e.ts > seen ? 'new' : ''}">
            <span class="ev-icon">${ICONS[e.kind] || '•'}</span>
            <div style="min-width:0;flex:1"><b>${esc(String(e.title).replace(/^[^\p{L}\d]+/u, ''))}</b>${multi && e.room ? ` <span class="muted small">· ${esc(e.room)}</span>` : ''}
              <div class="muted small">${esc(String(e.text || '').replace(' · הקישו לצפייה', ''))}</div></div>
            <div class="ev-side"><span class="muted small">${dayTime(e.ts)}</span>${e.at ? `<button class="back small" data-ev="${i}">▶ צפייה</button>` : ''}</div>
          </li>`).join('')}</ul>` : '<p class="muted">עוד לא קרה כלום. בכי, תנועה, סוללה נמוכה וסיכומי בוקר יופיעו כאן.</p>'}
      </div>`;
    $('#clearEv', p) && ($('#clearEv', p).onclick = () => events.clear());
    $$('[data-ev]', p).forEach((b) => (b.onclick = () => { const e = events.list[+b.dataset.ev]; showRoom(e.code, e.at); }));
  }
  const onEvents = () => { if (current === 'events') { store.set('bm-events-seen', Date.now()); renderEvents(); } renderBadge(); };
  events.listeners.add(onEvents);
  store.set('bm-events-seen-prev', store.get('bm-events-seen', 0));

  // ---------- הגדרות ----------
  function renderSettings() {
    const p = $('#pane-settings');
    p.innerHTML = `
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <b>איך לקבל התראות</b>
        <div class="seg seg4" id="modes">${Object.entries(ALERT_MODES).map(([k, m]) => `<button data-mode="${k}">${m.label}</button>`).join('')}</div>
        <div class="muted small" id="modeHint"></div>
        ${toggleRow('motion', '👋 התראה על תנועה', S.motion, 'כשהמצלמה דולקת ויש תנועה בעריסה')}
        ${toggleRow('quiet', '🌙 שעות שקטות', S.quiet.on, 'בשעות האלה ההתראות שקטות אוטומטית (רק הודעה)')}
        <div class="row small" id="quietTimes">
          <label>מ-<input type="time" id="qFrom" value="${S.quiet.from}"></label>
          <label>עד <input type="time" id="qTo" value="${S.quiet.to}"></label>
        </div>
        ${toggleRow('morning', '🌅 סיכום בוקר', S.morning.on, 'כמה פעמים התינוק בכה בלילה ולכמה זמן')}
        <div class="row small" id="mTimeRow"><span>בשעה</span><input type="time" id="mTime" value="${S.morning.at}"></div>
        <button class="btn dark" id="test">בדיקת התראה</button>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:10px">
        <b>חדרים</b>
        ${rooms.map((r, i) => `<div class="row"><span>👶 ${esc(r.name)} <span class="muted small">· קוד ${esc(r.code)}</span></span>
          <button class="back small" data-del="${i}">הסרה</button></div>`).join('')}
        <button class="btn dark" id="addRoom">➕ הוספת חדר / תינוק נוסף</button>
      </div>`;
    const renderModes = () => {
      $$('#modes button', p).forEach((b) => b.classList.toggle('on', b.dataset.mode === S.alertMode));
      $('#modeHint', p).textContent = ALERT_MODES[S.alertMode].hint + (inQuiet() && S.alertMode !== 'off' ? ' · עכשיו שעות שקטות' : '');
      $('#quietTimes', p).hidden = !S.quiet.on;
      $('#mTimeRow', p).hidden = !S.morning.on;
    };
    renderModes();
    $$('#modes button', p).forEach((b) => (b.onclick = () => { S.alertMode = b.dataset.mode; store.set('bm-alert', S.alertMode); renderModes(); }));
    $('#motion', p).onchange = (e) => { S.motion = e.target.checked; store.set('bm-motion', S.motion ? '1' : '0'); };
    $('#quiet', p).onchange = (e) => { S.quiet.on = e.target.checked; store.set('bm-quiet', S.quiet.on ? '1' : '0'); renderModes(); };
    $('#qFrom', p).onchange = (e) => { S.quiet.from = e.target.value; store.set('bm-qfrom', S.quiet.from); renderModes(); };
    $('#qTo', p).onchange = (e) => { S.quiet.to = e.target.value; store.set('bm-qto', S.quiet.to); renderModes(); };
    $('#morning', p).onchange = (e) => { S.morning.on = e.target.checked; store.set('bm-morning', S.morning.on ? '1' : '0'); renderModes(); };
    $('#mTime', p).onchange = (e) => { S.morning.at = e.target.value; store.set('bm-mtime', S.morning.at); };
    $('#test', p).onclick = () => notify(rooms[0], 'test', '🔔 בדיקה', 'כך תיראה התראה במצב ' + ALERT_MODES[effectiveMode()].label);
    $('#addRoom', p).onclick = () => go('parent', { add: true });
    $$('[data-del]', p).forEach((b) => (b.onclick = () => {
      if (b.dataset.armed) { rooms.splice(+b.dataset.del, 1); saveRooms(rooms); go('parent'); return; }
      b.dataset.armed = '1'; b.textContent = 'ללחוץ שוב להסרה';
      setTimeout(() => { delete b.dataset.armed; b.textContent = 'הסרה'; }, 3000);
    }));
  }
  renderSettings();

  // ---------- סיכום בוקר ----------
  const morningTick = ticker(30000, () => {
    if (!S.morning.on) return;
    const d = new Date(), today = d.toDateString();
    const [h, m] = S.morning.at.split(':').map(Number);
    const mins = d.getHours() * 60 + d.getMinutes(), target = h * 60 + m;
    if (mins >= target && mins < target + 120 && store.get('bm-morning-last') !== today) {
      store.set('bm-morning-last', today);
      conns.forEach((c) => c.requestSummary());
    }
  });

  showTab('r0');
  renderBadge();

  setTeardown(() => {
    morningTick();
    events.listeners.delete(onEvents);
    conns.forEach((c) => c.teardown());
    actx.close();
    nativeCall('stop');
  });
}

// ================= חיבור לחדר אחד =================
function connectRoom(room, pane, { actx, S, notify }) {
  const q = (sel) => pane.querySelector(sel);
  const qq = (sel) => pane.querySelectorAll(sel);
  const me = rid(); // מזהה חדש לכל חיבור, כך שכמה הורים לא מתנגשים
  const code = room.code;
  const k = (name) => `bm-${name}-${code}`; // הגדרות לכל חדר בנפרד

  const live = document.createElement('video');
  live.autoplay = true; live.playsInline = true; live.muted = true;
  const analyser = actx.createAnalyser();
  analyser.fftSize = 2048;
  const buf = new Float32Array(analyser.fftSize);
  const relayGain = actx.createGain();
  relayGain.connect(actx.destination);

  let listen = store.get(k('listen'), '1') === '1';
  let watch = store.get(k('watch'), '1') === '1';
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

  pane.innerHTML = `
    <div class="card">
      <div class="status"></div>
      <div class="meter"><i></i></div>
      <div class="row muted small" style="margin-top:6px"><span>עוצמת הקול בחדר</span><span class="info"></span></div>
    </div>
    <div class="video videoBox" hidden></div>
    <div class="vctl">
      <button class="camBtn"></button><button class="flipBtn" title="החלפת מצלמה">🔄</button><button class="torchBtn" title="פנס">🔦</button>
      <button class="brightBtn" title="הבהרת תמונה">🌗</button><button class="snapBtn" title="צילום">📸</button><button class="watchBtn" title="הצגת וידאו">👁️</button>
    </div>
    <div class="row">
      <button class="btn listen" style="flex:2"></button>
      <button class="btn dark talk" style="flex:1">🎙️ דברו</button>
    </div>

    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="row"><b>📈 מה היה בחדר</b>
        <div class="seg small-seg range">${[1, 3, 12].map((h) => `<button data-h="${h}">${h === 1 ? 'שעה' : h + ' שעות'}</button>`).join('')}</div></div>
      <div class="small sumline"></div>
      <canvas class="graph"></canvas>
      <div class="muted small histHint">הקישו על הגרף כדי לראות ולשמוע מה קרה באותו רגע. אדום = בכי.</div>
      <div class="video player" hidden><video class="pv" playsinline controls></video></div>
      <div class="row pctl" dir="ltr" hidden>
        <button class="btn dark pPrev" style="flex:1">⏪ 30</button>
        <span class="muted small pTime" style="flex:1;text-align:center"></span>
        <button class="btn dark pSave" style="flex:1" title="שמירה לגלריה">💾</button>
        <button class="btn dark pNext" style="flex:1">30 ⏩</button>
      </div>
    </div>

    <div class="card" style="display:flex;flex-direction:column;gap:12px">
      <b>🎵 צלילי הרגעה בחדר</b>
      <div class="seg sounds">${Object.entries(SOUNDS).map(([key, l]) => `<button data-s="${key}">${l}</button>`).join('')}</div>
      <div class="row small">
        <span>לכמה זמן</span>
        <select class="sMin"><option value="15">15 דקות</option><option value="30" selected>30 דקות</option><option value="60">שעה</option><option value="0">בלי הגבלה</option></select>
      </div>
      <label class="small">עוצמה<input type="range" class="sVol" min="5" max="100" value="${store.get('bm-svol', 50)}"></label>
      <div class="muted small soundState"></div>
    </div>`;
  q('.videoBox').appendChild(live);
  const pv = q('.pv');

  // ---------- תצוגה ----------
  const renderListen = () => {
    const b = q('.listen');
    b.className = 'btn listen ' + (listen ? 'ok' : 'dark');
    b.textContent = listen ? '🔊 שומעים את החדר' : '🔇 השמע החי מושתק';
    live.muted = !listen || talking;
    relayGain.gain.value = listen && !talking ? 1 : 0;
  };
  function renderBaby() {
    q('.videoBox').hidden = !(watch && baby.video && audioOn);
    q('.camBtn').textContent = baby.video ? '📷 כיבוי מצלמה' : '📷 הדלקת מצלמה';
    q('.camBtn').classList.toggle('on', baby.video);
    q('.flipBtn').hidden = !baby.video;
    q('.torchBtn').hidden = !(baby.video && baby.torchAvail);
    q('.torchBtn').classList.toggle('on', !!baby.torch);
    q('.brightBtn').hidden = q('.snapBtn').hidden = !(baby.video && audioOn && watch);
    q('.watchBtn').hidden = !baby.video;
    q('.watchBtn').classList.toggle('on', watch);
    q('.brightBtn').classList.toggle('on', bright);
    q('.talk').disabled = !audioOn;
    const st = baby.sound || { type: 'none' };
    qq('.sounds button').forEach((b) => b.classList.toggle('on', b.dataset.s === st.type));
    q('.soundState').textContent = st.type && st.type !== 'none' ? `${SOUNDS[st.type]} מתנגן${st.until ? ' עד ' + time(st.until) : ''}` : 'לא מתנגן כלום';
    const info = [];
    if (baby.battery != null) info.push(`🔋 ${baby.battery}%${baby.charging ? '⚡' : ''}`);
    if (baby.temp != null) info.push(`🌡️ ${baby.temp}°`);
    q('.info').textContent = info.join(' · ');
  }
  function renderStatus() {
    const el = q('.status');
    const now = Date.now();
    if (babySeen === null) {
      el.innerHTML = '<span class="dot wait"></span>מחפש את מכשיר התינוק… ודאו שלחצו שם על "התחלה"';
    } else if (now - babySeen > LOST_MS) {
      el.innerHTML = `<b style="color:var(--bad)"><span class="dot bad"></span>אין קשר עם מכשיר התינוק כבר ${Math.round((now - babySeen) / 1000)} שניות</b>`;
    } else {
      const how = audioOn ? (baby.video && watch ? 'שמע ווידאו חיים' : 'שמע חי') : relayOn ? 'שמע דרך השרת (איכות טלפון)' : 'שמע חי מתחבר…';
      el.innerHTML = `<div class="row"><span style="color:var(--ok)"><span class="dot ok"></span>מחובר לחדר</span>
        <span class="muted small">${how}</span></div>`;
    }
    renderBaby();
  }
  renderListen();

  // ---------- כפתורים ----------
  q('.listen').onclick = () => { listen = !listen; store.set(k('listen'), listen ? '1' : '0'); renderListen(); };
  q('.watchBtn').onclick = () => { watch = !watch; store.set(k('watch'), watch ? '1' : '0'); send('prefs', { from: me, video: watch }); renderStatus(); };
  q('.camBtn').onclick = () => {
    if (!baby.video && !baby.camAllowed) { toast('במכשיר התינוק לא אושרה הרשאת מצלמה'); return; }
    cmd('camera', { on: !baby.video });
    if (!baby.video && !watch) { watch = true; store.set(k('watch'), '1'); send('prefs', { from: me, video: true }); }
    toast(baby.video ? 'מכבה את המצלמה…' : 'מדליק את המצלמה…');
  };
  q('.flipBtn').onclick = () => cmd('flip');
  q('.torchBtn').onclick = () => cmd('torch', { on: !baby.torch });
  q('.brightBtn').onclick = () => {
    bright = !bright;
    const f = bright ? 'brightness(1.9) contrast(1.15)' : '';
    live.style.filter = f; pv.style.filter = f;
    renderBaby();
  };
  q('.snapBtn').onclick = () => snapshot();
  qq('.sounds button').forEach((b) => (b.onclick = () => cmd('sound', { type: b.dataset.s, minutes: +q('.sMin').value, vol: +q('.sVol').value / 100 })));
  q('.sVol').onchange = (e) => {
    store.set('bm-svol', e.target.value);
    const st = baby.sound;
    if (st?.type && st.type !== 'none') cmd('sound', { type: st.type, minutes: st.until ? Math.max(1, Math.round((st.until - Date.now()) / 60000)) : 0, vol: +e.target.value / 100 });
  };

  async function snapshot() {
    if (!live.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = live.videoWidth; c.height = live.videoHeight;
    const x = c.getContext('2d');
    if (bright) x.filter = 'brightness(1.9) contrast(1.15)';
    x.drawImage(live, 0, 0);
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
    q('.talk').classList.add('on'); q('.talk').textContent = '🎙️ מדברים…';
    renderListen();
  }
  function talkStop() {
    if (!talking) return;
    talking = false;
    audioSender()?.replaceTrack(null);
    q('.talk').classList.remove('on'); q('.talk').textContent = '🎙️ דברו';
    renderListen();
  }
  q('.talk').addEventListener('pointerdown', talkStart);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => q('.talk').addEventListener(ev, talkStop));

  // ---------- היסטוריה ----------
  const graph = q('.graph');
  const redraw = () => hist && drawGraph(graph, { ...hist, sel });
  function renderSummary() {
    if (!hist) return;
    const cries = hist.cries || [];
    const total = cries.reduce((a, [s, e]) => a + Math.max(5, Math.round((e - s) / 1000)), 0);
    const label = histHours === 1 ? 'בשעה האחרונה' : `ב-${histHours} השעות האחרונות`;
    q('.sumline').innerHTML = cries.length
      ? `<span style="color:var(--bad)">●</span> ${label}: ${cries.length} ${cries.length === 1 ? 'פעם' : 'פעמים'} בכי, סה"כ ${fmtDur(total)}`
      : `<span style="color:var(--ok)">●</span> ${label}: שקט, בלי בכי`;
  }
  function askHistory() { histAsked = Date.now(); send('hist-req', { from: me, hours: histHours }); }
  qq('.range button').forEach((b) => (b.onclick = () => {
    histHours = +b.dataset.h;
    qq('.range button').forEach((x) => x.classList.toggle('on', x === b));
    askHistory();
  }));
  q(`.range button[data-h="${histHours}"]`).classList.add('on');
  graph.onclick = (e) => {
    if (!hist) return;
    const r = graph.getBoundingClientRect();
    // הזמן זורם משמאל לימין, כמו במוניטור
    const at = hist.start + ((e.clientX - r.left) / r.width) * (hist.until - hist.start);
    playAt(at - 5000);
  };
  window.addEventListener('resize', redraw);

  let playing = null; // {meta, url, blob}
  async function playAt(at) {
    sel = at; redraw();
    q('.graph').scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (!clips.ready) { q('.histHint').textContent = 'צפייה בהקלטות עובדת רק כשיש חיבור ישיר למכשיר התינוק.'; return; }
    q('.histHint').textContent = 'טוען הקלטה מ-' + timeSec(at) + '…';
    const clip = await clips.request(at).catch(() => null);
    if (!clip) { q('.histHint').textContent = 'אין הקלטה מהזמן הזה.'; return; }
    if (playing) URL.revokeObjectURL(playing.url);
    playing = { meta: clip.meta, url: URL.createObjectURL(clip.blob), blob: clip.blob };
    q('.player').hidden = false; q('.pctl').hidden = false;
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
    q('.histHint').textContent = clip.meta.v ? 'וידאו ושמע מההקלטה' : 'שמע מההקלטה (המצלמה הייתה כבויה)';
  }
  function updateTime() {
    if (!playing) return;
    sel = playing.meta.s + pv.currentTime * 1000;
    q('.pTime').textContent = timeSec(sel);
    redraw();
  }
  pv.onended = () => playing && playAt(playing.meta.e + 200);
  pv.onplay = () => { live.muted = true; relayGain.gain.value = 0; };
  pv.onpause = () => renderListen();
  q('.pPrev').onclick = () => playAt((sel || Date.now()) - 30000);
  q('.pNext').onclick = () => playAt((sel || Date.now()) + 30000);
  q('.pSave').onclick = async () => {
    if (!playing) return;
    if (!native) { toast('שמירת סרטון עובדת באפליקציה בטלפון'); return; }
    const data = await blobToBase64(playing.blob);
    const mime = (playing.meta.mime || 'video/webm').split(';')[0];
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const name = `baby-${room.name}-${new Date(playing.meta.s).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`;
    const ok = await Monitor.saveVideo({ data, mime, name }).then(() => true, () => false);
    toast(ok ? '💾 הקטע נשמר בגלריה (תיקייה BabyMonitor)' : 'לא הצלחנו לשמור את הקטע');
  };

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
      if (baby.battery != null) {
        if (baby.battery <= 20 && !baby.charging && !lowBattNotified) { lowBattNotified = true; notify(room, 'battery', '🔋 סוללה נמוכה', `במכשיר התינוק נשארו ${baby.battery}%`); }
        if (baby.battery > 30 || baby.charging) lowBattNotified = false;
      }
      if (prevCharging === true && baby.charging === false) notify(room, 'charger', '🔌 המטען התנתק', 'מכשיר התינוק כבר לא בטעינה');
      if (baby.charging != null) prevCharging = baby.charging;
      renderBaby();
    })
    .on('broadcast', { event: 'cry' }, ({ payload }) => {
      babySeen = Date.now();
      notify(room, 'cry', '👶 התינוק בוכה', 'התחיל ב-' + time(payload.ts) + ' · הקישו לצפייה', payload.ts - 10000);
      setTimeout(askHistory, 2000);
    })
    .on('broadcast', { event: 'motion' }, ({ payload }) => {
      if (S.motion) notify(room, 'motion', '👋 תנועה בחדר', time(payload.ts) + ' · הקישו לצפייה', payload.ts - 5000);
    })
    .on('broadcast', { event: 'hist' }, ({ payload }) => {
      if (payload.to !== me) return;
      hist = { start: payload.start, until: payload.until, step: payload.step, data: b64.dec(payload.d), spans: payload.spans, cries: payload.cries, threshold: payload.threshold };
      redraw(); renderSummary();
    })
    .on('broadcast', { event: 'sum' }, ({ payload }) => {
      if (payload.to !== me) return;
      const text = payload.count
        ? `${payload.count} ${payload.count === 1 ? 'פעם' : 'פעמים'} בכי, סה"כ ${fmtDur(payload.total)}. הארוך ביותר: ${fmtDur(payload.longest)}`
        : 'לילה שקט, בלי בכי 🎉';
      notify(room, 'summary', '🌅 סיכום הלילה', text, payload.first ? payload.first - 10000 : undefined);
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
    if (!document.hidden && !pane.hidden) {
      if (audioOn || relayOn) { analyser.getFloatTimeDomainData(buf); setMeter(q('.meter'), levelFrom(buf)); }
      else setMeter(q('.meter'), babyLevel);
    }
    if (babySeen !== null && !audioOn) {
      // שמע ישיר לא מתחבר: ממשיכים לנסות, ובינתיים עוברים לשמע דרך השרת
      if (now - lastHello > 10000) hello();
      if (helloSince && now - helloSince > RELAY_AFTER_MS) setRelay(true);
    }
    if (relayOn && now - relayPing > 10000) { relayPing = now; send('relay', { from: me, on: true }); }
    if (babySeen !== null && now - babySeen > LOST_MS && !lostNotified) {
      lostNotified = true;
      notify(room, 'lost', '⚠️ הקשר עם מכשיר התינוק נותק', 'בדקו את מכשיר התינוק ואת החיבור לאינטרנט');
    }
    if (!document.hidden && !pane.hidden && babySeen !== null && now - histAsked > 60000) askHistory();
    if (now - lastRender > 1000) { lastRender = now; renderStatus(); }
  });
  renderStatus();

  return {
    onShow() { redraw(); },
    playAt,
    requestSummary() { const now = Date.now(); send('sum-req', { from: me, since: now - 12 * 3600000, until: now }); },
    teardown() {
      stopTick();
      talkStop();
      micStream?.getTracks().forEach((t) => t.stop());
      send('bye', { from: me });
      pc?.close();
      supabase.removeChannel(ch);
      window.removeEventListener('resize', redraw);
      live.srcObject = null;
      if (playing) URL.revokeObjectURL(playing.url);
    },
  };
}
