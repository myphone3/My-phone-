import qrcode from 'qrcode-generator';
import {
  getIce, HEARTBEAT_MS, RELAY_RATE, RELAY_CHUNK_MS, supabase, store, time, $, toast, ticker, levelFrom, setMeter,
  nativeCall, muEncode, muDecode, channelFor, views, go, setTeardown, toggleRow, batteryHint, deviceInfo, soundPlayer, SOUNDS,
} from './common.js';
import { LevelLog, Recorder, recordedSpans, storageInfo, sendClip, findClip, clipBlob, b64, STEP, HOUR } from './history.js';

const EPISODE_GAP_MS = 60000; // בכי שמתחיל אחרי דקה של שקט הוא בכי חדש (והתראה חדשה)
const MOTION_COOLDOWN_MS = 60000;

const newCode = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 ספרות: קשה לנחש

function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

// סיכום בכי לטווח זמן
export function summarize(log, since, until) {
  const items = log.filter((x) => x.e >= since && x.s <= until);
  const secs = items.map((x) => Math.max(5, Math.round((Math.min(x.e, until) - Math.max(x.s, since)) / 1000)));
  return { count: items.length, total: secs.reduce((a, b) => a + b, 0), longest: Math.max(0, ...secs), first: items[0]?.s ?? null, last: items[items.length - 1]?.s ?? null };
}

views.baby = function baby({ auto = false } = {}) {
  let code = store.get('bm-code');
  if (!code) { code = newCode(); store.set('bm-code', code); }
  let sensitivity = +store.get('bm-sens', 60);
  let camWanted = store.get('bm-cam', '0') === '1';
  let facing = store.get('bm-facing', 'environment');
  let recOn = store.get('bm-rec', '1') === '1';
  let retention = +store.get('bm-ret', 3);

  app().innerHTML = `
    <div class="top"><h1>מכשיר התינוק</h1><button class="back" id="back">חזרה</button></div>
    <div class="card codecard">
      <div class="qr" id="qr">${qrSvg('BM:' + code)}</div>
      <div style="min-width:0">
        <div class="muted small">סרקו את הקוד במכשיר ההורה, או הקלידו:</div>
        <div class="code">${code}</div>
        <button class="back small" id="newcode">קוד חדש</button>
      </div>
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
  $('#back').onclick = () => { store.del('bm-autostart'); go('home'); };
  $('#newcode').onclick = () => { store.set('bm-code', newCode()); go('baby'); };
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
  if (auto) start();

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
    store.set('bm-autostart', 'baby'); // אם האפליקציה נסגרת, היא תמשיך לבד בפתיחה הבאה
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
    let log = store.json('bm-log', []).filter((x) => x.s > Date.now() - 7 * 24 * HOUR);
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
    $('#stop').onclick = () => { store.del('bm-autostart'); go('baby'); };
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
      const pc = new RTCPeerConnection(await getIce());
      const peer = { pc, video: !!wantVideo, videoSender: null, dc: null, talk: null };
      peers.get(pid)?.pc?.close();
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
        if (payload.on) relayListeners.set(payload.from, { seen: Date.now(), video: !!payload.video }); else relayListeners.delete(payload.from);
        showParents();
      })
      .on('broadcast', { event: 'hist-req' }, ({ payload }) => sendHistory(payload.from, payload.hours).catch(console.warn))
      .on('broadcast', { event: 'sum-req' }, ({ payload }) => {
        send('sum', { to: payload.from, since: payload.since, until: payload.until, ...summarize(log, payload.since, payload.until) });
      })
      .on('broadcast', { event: 'clip-req' }, ({ payload }) => sendClipRelay(payload).catch(console.warn))
      .on('broadcast', { event: 'talk-pcm' }, ({ payload }) => playTalk(payload))
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

    // ---- כשאין חיבור ישיר: תמונה כל 2 שניות, הקלטות ודיבור דרך השרת ----
    const fc = document.createElement('canvas');
    fc.width = 320; fc.height = 240;
    const fctx = fc.getContext('2d');
    function sendRelayFrame() {
      if (!videoTrack || mv.readyState < 2 || ![...relayListeners.values()].some((l) => l.video)) return;
      fc.height = Math.round((mv.videoHeight / mv.videoWidth) * 320) || 240;
      fctx.drawImage(mv, 0, 0, fc.width, fc.height);
      send('frame', { ts: Date.now(), d: fc.toDataURL('image/jpeg', 0.6).split(',')[1] });
    }
    async function sendClipRelay(req) {
      const meta = await findClip(req.at);
      const blob = meta && (await clipBlob(meta.s));
      if (!meta || !blob) { send('clip-part', { to: req.from, id: req.id, none: true }); return; }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const size = 48 * 1024, n = Math.ceil(bytes.length / size);
      for (let i = 0; i < n; i++) {
        send('clip-part', { to: req.from, id: req.id, i, n, ...(i === 0 ? { meta } : {}), d: b64.enc(bytes.subarray(i * size, (i + 1) * size)) });
        await new Promise((r) => setTimeout(r, 120)); // לא להציף את השרת
      }
    }
    let talkNext = 0;
    function playTalk(p) {
      const bytes = b64.dec(p.d);
      const ab = ctx.createBuffer(1, bytes.length, p.rate);
      const data = ab.getChannelData(0);
      for (let i = 0; i < bytes.length; i++) data[i] = muDecode(bytes[i]);
      const s = ctx.createBufferSource();
      s.buffer = ab; s.connect(ctx.destination);
      const now = ctx.currentTime;
      if (talkNext < now + 0.05 || talkNext > now + 2) talkNext = now + 0.3;
      s.start(talkNext); talkNext += ab.duration;
    }

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
    const saveLog = () => { store.setJson('bm-log', log); logDirty = false; };
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
      if (tickN % 20 === 0) sendRelayFrame();
      recorder?.tick();
      sound.tick();
      if (now - lastDevAt > 60000) { lastDevAt = now; deviceInfo().then((d) => { lastDevice = d; }); }
      if (now - lastBeat > HEARTBEAT_MS) {
        lastBeat = now;
        sendStatus({ crying: isCrying, level: lv });
        relayListeners.forEach((l, pid) => now - l.seen > 30000 && relayListeners.delete(pid));
        if (sound.state.type === 'none' && $('#soundNow') && !$('#soundNow').hidden) renderRunning();
      }
      if (now - lastFlush > 30000) {
        lastFlush = now;
        levels.flush();
        if (logDirty) { log = log.filter((x) => x.s > now - 7 * 24 * HOUR); saveLog(); }
        if (now - lastPrune > 10 * 60000) { lastPrune = now; levels.prune(now - 24 * HOUR); showStorage(); }
      }
    });

    setTeardown(() => {
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
    });
  }
};

function app() { return document.getElementById('app'); }
