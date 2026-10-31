'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

// ביבי-מוניטור: מכשיר אחד בחדר התינוק מאזין, מכשיר ההורה מקבל שמע חי והתראה כשיש בכי.
// התקשורת: Supabase Realtime (broadcast) לאיתות ולהתראות, WebRTC לשמע החי.

type Mode = 'home' | 'baby' | 'parent';

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

function newCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

// עוצמת קול 0-100 מתוך נתוני גל
function levelFrom(buf: Float32Array) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  const db = 20 * Math.log10(rms + 1e-8); // בערך -100 עד 0
  return Math.max(0, Math.min(100, Math.round((db + 70) * (100 / 60))));
}

async function keepAwake(): Promise<WakeLockSentinel | null> {
  try {
    if ('wakeLock' in navigator) return await (navigator as any).wakeLock.request('screen');
  } catch {}
  return null;
}

/* ---------------------------------------------------------------- */

export default function MonitorPage() {
  const [mode, setMode] = useState<Mode>('home');

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950 text-slate-100" dir="rtl">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 py-6">
        {mode === 'home' && <Home onPick={setMode} />}
        {mode === 'baby' && <BabyUnit onExit={() => setMode('home')} />}
        {mode === 'parent' && <ParentUnit onExit={() => setMode('home')} />}
      </div>
    </div>
  );
}

function Home({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="pt-6 text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-300 shadow-[0_0_40px_rgba(252,211,77,.45)]" />
        <h1 className="text-3xl font-bold">ביבי-מוניטור</h1>
        <p className="mt-2 text-slate-400">
          שמים מכשיר אחד בחדר של התינוק, ומחברים אליו את המכשיר שלכם. כשהתינוק בוכה, תשמעו מיד.
        </p>
      </div>

      <button
        onClick={() => onPick('baby')}
        className="rounded-2xl bg-slate-800 p-5 text-right ring-1 ring-slate-700 transition hover:bg-slate-700"
      >
        <div className="text-xl font-bold">👶 מכשיר התינוק</div>
        <div className="mt-1 text-sm text-slate-400">המכשיר שנשאר בחדר ומקשיב</div>
      </button>

      <button
        onClick={() => onPick('parent')}
        className="rounded-2xl bg-amber-300 p-5 text-right text-slate-900 transition hover:bg-amber-200"
      >
        <div className="text-xl font-bold">🎧 מכשיר ההורה</div>
        <div className="mt-1 text-sm text-slate-700">המכשיר שאתם לוקחים איתכם</div>
      </button>

      <ul className="mt-auto space-y-1 text-xs text-slate-500">
        <li>• שני המכשירים צריכים חיבור לאינטרנט (WiFi או סלולר).</li>
        <li>• השאירו את המסך של שני המכשירים פתוח על הדף הזה. המסך יוחשך אבל לא יינעל.</li>
        <li>• חברו את מכשיר התינוק למטען.</li>
      </ul>
    </div>
  );
}

/* --------------------------- מכשיר התינוק --------------------------- */

function BabyUnit({ onExit }: { onExit: () => void }) {
  const [code] = useState(() => {
    try {
      const saved = localStorage.getItem('bm-code');
      if (saved) return saved;
      const c = newCode();
      localStorage.setItem('bm-code', c);
      return c;
    } catch {
      return newCode();
    }
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [level, setLevel] = useState(0);
  const [sensitivity, setSensitivity] = useState(60);
  const [parents, setParents] = useState(0);
  const [lastCry, setLastCry] = useState<number | null>(null);
  const [dim, setDim] = useState(false);

  const sensRef = useRef(sensitivity);
  sensRef.current = sensitivity;
  const cleanup = useRef<() => void>(() => {});

  const start = useCallback(async () => {
    setError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch {
      setError('אין גישה למיקרופון. אשרו הרשאת מיקרופון בדפדפן ונסו שוב.');
      return;
    }

    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const peers = new Map<string, RTCPeerConnection>();
    const channel: RealtimeChannel = supabase.channel('bm-' + code, {
      config: { broadcast: { self: false } },
    });
    const send = (event: string, payload: any) =>
      channel.send({ type: 'broadcast', event, payload });

    const updateParents = () =>
      setParents(Array.from(peers.values()).filter((p) => p.connectionState === 'connected').length);

    const connectParent = async (parentId: string) => {
      peers.get(parentId)?.close();
      const pc = new RTCPeerConnection(ICE);
      peers.set(parentId, pc);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.onicecandidate = (e) => {
        if (e.candidate) send('ice', { to: parentId, from: 'baby', candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        updateParents();
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peers.delete(parentId);
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send('offer', { to: parentId, sdp: pc.localDescription });
    };

    channel
      .on('broadcast', { event: 'hello' }, ({ payload }) => {
        connectParent(payload.from).catch(() => {});
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        peers.get(payload.from)?.setRemoteDescription(payload.sdp).catch(() => {});
      })
      .on('broadcast', { event: 'ice' }, ({ payload }) => {
        if (payload.to !== 'baby') return;
        peers.get(payload.from)?.addIceCandidate(payload.candidate).catch(() => {});
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') send('baby-online', {});
      });

    // זיהוי בכי: קול מעל הסף ברוב הזמן של חלון של 2 שניות
    const samples: number[] = [];
    let crying = false;
    let lastAlert = 0;
    let lastLevelSent = 0;
    let raf = 0;
    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      const lv = levelFrom(buf);
      setLevel(lv);
      const threshold = 100 - sensRef.current; // רגישות גבוהה = סף נמוך
      const now = Date.now();
      samples.push(lv > threshold ? 1 : 0);
      if (samples.length > 120) samples.shift(); // ~2 שניות ב-60fps
      const loudShare = samples.reduce((a, b) => a + b, 0) / samples.length;
      const isCrying = samples.length >= 60 && loudShare > 0.45;

      if (isCrying && !crying && now - lastAlert > 15000) {
        lastAlert = now;
        setLastCry(now);
        send('cry', { ts: now, level: lv });
      }
      crying = isCrying;
      if (now - lastLevelSent > 1000) {
        lastLevelSent = now;
        send('status', { ts: now, level: lv, crying });
      }
      raf = requestAnimationFrame(tick);
    };
    // requestAnimationFrame נעצר כשהמסך כבוי, לכן גם טיימר גיבוי
    const backup = setInterval(() => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        tick();
      }
    }, 500);
    tick();

    let lock = await keepAwake();
    const onVis = async () => {
      if (!document.hidden) {
        lock = await keepAwake();
        if (ctx.state === 'suspended') ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    cleanup.current = () => {
      cancelAnimationFrame(raf);
      clearInterval(backup);
      document.removeEventListener('visibilitychange', onVis);
      send('baby-offline', {});
      peers.forEach((p) => p.close());
      supabase.removeChannel(channel);
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
      lock?.release().catch(() => {});
    };
    setRunning(true);
  }, [code]);

  useEffect(() => () => cleanup.current(), []);

  const stop = () => {
    cleanup.current();
    cleanup.current = () => {};
    setRunning(false);
    setLevel(0);
    setParents(0);
  };

  if (dim && running) {
    return (
      <button
        onClick={() => setDim(false)}
        className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-black text-slate-700"
      >
        <div className="text-sm">מאזין… קוד {code}</div>
        <div className="mt-3 h-1 w-40 overflow-hidden rounded bg-slate-900">
          <div className="h-full bg-slate-700 transition-all" style={{ width: level + '%' }} />
        </div>
        <div className="mt-6 text-xs">הקישו כדי להאיר את המסך</div>
      </button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <TopBar title="מכשיר התינוק" onBack={() => { stop(); onExit(); }} />

      <div className="rounded-2xl bg-slate-900 p-5 text-center ring-1 ring-slate-800">
        <div className="text-sm text-slate-400">קוד החיבור. הקלידו אותו במכשיר ההורה</div>
        <div className="mt-2 font-mono text-6xl font-bold tracking-[0.3em] text-amber-300" dir="ltr">
          {code}
        </div>
      </div>

      {!running ? (
        <button onClick={start} className="rounded-2xl bg-amber-300 py-4 text-xl font-bold text-slate-900">
          התחלת האזנה
        </button>
      ) : (
        <>
          <div className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                מאזין
              </span>
              <span className={parents ? 'text-emerald-400' : 'text-slate-400'}>
                {parents ? `${parents} הורים מחוברים לשמע` : 'ממתין למכשיר הורה'}
              </span>
            </div>
            <Meter level={level} threshold={100 - sensitivity} />
            <label className="mt-4 block text-sm text-slate-300">
              רגישות: {sensitivity}
              <input
                type="range"
                min={10}
                max={90}
                value={sensitivity}
                onChange={(e) => setSensitivity(+e.target.value)}
                className="mt-1 w-full accent-amber-300"
              />
            </label>
            <p className="mt-1 text-xs text-slate-500">
              הקו הצהוב הוא הסף. קול שעובר אותו לאורך כשנייה נחשב בכי ושולח התראה.
            </p>
            {lastCry && (
              <p className="mt-3 text-sm text-rose-300">
                התראה אחרונה נשלחה ב-{new Date(lastCry).toLocaleTimeString('he-IL')}
              </p>
            )}
          </div>
          <button onClick={() => setDim(true)} className="rounded-2xl bg-slate-800 py-3 font-bold">
            החשכת המסך
          </button>
          <button onClick={stop} className="rounded-2xl py-3 text-rose-300 ring-1 ring-rose-400/40">
            עצירת האזנה
          </button>
        </>
      )}
      {error && <p className="rounded-xl bg-rose-500/15 p-3 text-rose-200">{error}</p>}
    </div>
  );
}

/* --------------------------- מכשיר ההורה --------------------------- */

function ParentUnit({ onExit }: { onExit: () => void }) {
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem('bm-parent-code') || '';
    } catch {
      return '';
    }
  });
  const [connected, setConnected] = useState(false);
  const [babySeen, setBabySeen] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [listen, setListen] = useState(true);
  const [alarm, setAlarm] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const audioEl = useRef<HTMLAudioElement>(null);
  const cleanup = useRef<() => void>(() => {});
  const alarmCtx = useRef<AudioContext | null>(null);
  const alarmTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lostAlerted = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const beep = useCallback(() => {
    const ctx = alarmCtx.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    [0, 0.25, 0.5].forEach((d) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.22);
    });
    try {
      navigator.vibrate?.([400, 150, 400, 150, 400]);
    } catch {}
  }, []);

  const startAlarm = useCallback(
    (ts: number) => {
      setAlarm(ts);
      if (alarmTimer.current) return;
      beep();
      alarmTimer.current = setInterval(beep, 2000);
    },
    [beep],
  );

  const stopAlarm = () => {
    if (alarmTimer.current) clearInterval(alarmTimer.current);
    alarmTimer.current = null;
    setAlarm(null);
  };

  const connect = async () => {
    if (!/^\d{4}$/.test(code)) return;
    try {
      localStorage.setItem('bm-parent-code', code);
    } catch {}
    // הלחיצה פותחת את השמע בדפדפן (חובה בטלפונים)
    alarmCtx.current = new AudioContext();
    alarmCtx.current.resume();
    if (audioEl.current) audioEl.current.play().catch(() => {});

    const me = rid();
    let pc: RTCPeerConnection | null = null;
    let offerTimer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase.channel('bm-' + code, { config: { broadcast: { self: false } } });
    const send = (event: string, payload: any) =>
      channel.send({ type: 'broadcast', event, payload });

    const hello = () => {
      send('hello', { from: me });
      if (offerTimer) clearTimeout(offerTimer);
      offerTimer = setTimeout(() => {
        if (!pc || pc.connectionState !== 'connected') hello();
      }, 8000);
    };

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== me) return;
        pc?.close();
        pc = new RTCPeerConnection(ICE);
        pc.ontrack = (e) => {
          if (audioEl.current) {
            audioEl.current.srcObject = e.streams[0];
            audioEl.current.play().catch(() => {});
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) send('ice', { to: 'baby', from: me, candidate: e.candidate.toJSON() });
        };
        pc.onconnectionstatechange = () => {
          const s = pc?.connectionState;
          setAudioOn(s === 'connected');
          if (s === 'failed' || s === 'disconnected') setTimeout(hello, 2000);
        };
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send('answer', { from: me, sdp: pc.localDescription });
      })
      .on('broadcast', { event: 'ice' }, ({ payload }) => {
        if (payload.to === me) pc?.addIceCandidate(payload.candidate).catch(() => {});
      })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        setBabySeen(Date.now());
        setLevel(payload.level);
        lostAlerted.current = false;
      })
      .on('broadcast', { event: 'cry' }, ({ payload }) => {
        setBabySeen(Date.now());
        startAlarm(payload.ts);
      })
      .on('broadcast', { event: 'baby-online' }, () => hello())
      .on('broadcast', { event: 'baby-offline' }, () => {
        setBabySeen(null);
        setAudioOn(false);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') hello();
      });

    let lock = await keepAwake();
    const onVis = async () => {
      if (!document.hidden) {
        lock = await keepAwake();
        alarmCtx.current?.resume();
      }
    };
    document.addEventListener('visibilitychange', onVis);

    cleanup.current = () => {
      if (offerTimer) clearTimeout(offerTimer);
      document.removeEventListener('visibilitychange', onVis);
      pc?.close();
      supabase.removeChannel(channel);
      lock?.release().catch(() => {});
      alarmCtx.current?.close();
      alarmCtx.current = null;
    };
    setConnected(true);
  };

  useEffect(() => () => {
    cleanup.current();
    if (alarmTimer.current) clearInterval(alarmTimer.current);
  }, []);

  useEffect(() => {
    if (audioEl.current) audioEl.current.muted = !listen;
  }, [listen]);

  // התראה אם מכשיר התינוק הפסיק לדווח
  const lost = connected && babySeen !== null && now - babySeen > 12000;
  useEffect(() => {
    if (lost && !lostAlerted.current) {
      lostAlerted.current = true;
      beep();
    }
  }, [lost, beep]);

  const disconnect = () => {
    cleanup.current();
    cleanup.current = () => {};
    stopAlarm();
    setConnected(false);
    setBabySeen(null);
    setAudioOn(false);
  };

  return (
    <div className="flex flex-1 flex-col gap-5">
      <audio ref={audioEl} autoPlay playsInline />
      <TopBar title="מכשיר ההורה" onBack={() => { disconnect(); onExit(); }} />

      {alarm && (
        <button
          onClick={stopAlarm}
          className="fixed inset-0 z-[120] flex animate-pulse flex-col items-center justify-center gap-4 bg-rose-600 text-white"
        >
          <div className="text-7xl">👶</div>
          <div className="text-4xl font-bold">התינוק בוכה</div>
          <div className="text-lg">{new Date(alarm).toLocaleTimeString('he-IL')}</div>
          <div className="mt-6 rounded-full bg-white/20 px-6 py-3 text-lg font-bold">הקישו להשתקת ההתראה</div>
        </button>
      )}

      {!connected ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
          <label className="text-sm text-slate-300" htmlFor="bm-code">
            הקלידו את הקוד שמופיע במכשיר התינוק
          </label>
          <input
            id="bm-code"
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            dir="ltr"
            className="rounded-xl bg-slate-800 py-4 text-center font-mono text-5xl tracking-[0.3em] text-amber-300 outline-none ring-1 ring-slate-700 focus:ring-amber-300"
            placeholder="0000"
          />
          <button
            onClick={connect}
            disabled={!/^\d{4}$/.test(code)}
            className="rounded-2xl bg-amber-300 py-4 text-xl font-bold text-slate-900 disabled:opacity-40"
          >
            התחברות
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
            <StatusLine babySeen={babySeen} lost={lost} audioOn={audioOn} now={now} />
            <Meter level={level} />
            <p className="mt-2 text-xs text-slate-500">עוצמת הקול בחדר התינוק</p>
          </div>

          <button
            onClick={() => setListen((v) => !v)}
            className={`rounded-2xl py-4 text-lg font-bold ${
              listen ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200'
            }`}
          >
            {listen ? '🔊 שומעים את החדר. הקישו להשתקה' : '🔇 השמע מושתק. רק התראות בכי'}
          </button>
          <button onClick={beep} className="rounded-2xl bg-slate-800 py-3 font-bold">
            בדיקת צליל ההתראה
          </button>
          <button onClick={disconnect} className="rounded-2xl py-3 text-rose-300 ring-1 ring-rose-400/40">
            ניתוק
          </button>
        </>
      )}
    </div>
  );
}

/* --------------------------- רכיבים קטנים --------------------------- */

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{title}</h1>
      <button onClick={onBack} className="rounded-full px-3 py-1.5 text-sm text-slate-400 ring-1 ring-slate-700">
        חזרה
      </button>
    </div>
  );
}

function Meter({ level, threshold }: { level: number; threshold?: number }) {
  const color = level > 70 ? 'bg-rose-400' : level > 40 ? 'bg-amber-300' : 'bg-emerald-400';
  return (
    <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-slate-800" dir="ltr">
      <div className={`h-full ${color} transition-[width] duration-150`} style={{ width: level + '%' }} />
      {threshold !== undefined && (
        <div className="absolute inset-y-0 w-0.5 bg-amber-200" style={{ left: threshold + '%' }} />
      )}
    </div>
  );
}

function StatusLine({
  babySeen,
  lost,
  audioOn,
  now,
}: {
  babySeen: number | null;
  lost: boolean;
  audioOn: boolean;
  now: number;
}) {
  if (babySeen === null)
    return (
      <div className="flex items-center gap-2 text-slate-300">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
        מחפש את מכשיר התינוק… ודאו שלחצו שם על &quot;התחלת האזנה&quot;
      </div>
    );
  if (lost)
    return (
      <div className="flex items-center gap-2 font-bold text-rose-300">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        אין קשר עם מכשיר התינוק כבר {Math.round((now - babySeen) / 1000)} שניות
      </div>
    );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-emerald-300">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        מחובר לחדר התינוק
      </span>
      <span className="text-xs text-slate-400">{audioOn ? 'שמע חי פעיל' : 'שמע חי מתחבר… ההתראות פעילות'}</span>
    </div>
  );
}
