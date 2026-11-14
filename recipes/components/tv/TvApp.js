'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getKitchen } from '@/lib/api';
import { useCast } from '@/lib/cast';
import { getKitchenId, setKitchenId } from '@/lib/local';
import { KEY, moveFocus, focusFirst } from '@/lib/spatial';
import { flatSteps, detectMinutes } from '@/lib/recipe';
import { addTimer, useNow, useAlarms, removeTimer } from '@/lib/timers';
import { unlockAudio } from '@/lib/sound';
import { setMusic } from '@/lib/music';
import { TvPair, TvHome, TvRecipe, TvCook, TvOriginal, TvTimers, TvIngredients, TvChef, TvIdle, Clock } from './TvScreens';
import TvMusic from './TvMusic';

const IDLE_MS = 4 * 60 * 1000;

export default function TvApp() {
  const [kid, setKid] = useState(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [started, setStarted] = useState(0);
  const [notice, setNotice] = useState('');
  const [chef, setChef] = useState(null);
  const [remoteInfo, setRemoteInfo] = useState(null);
  const [idle, setIdle] = useState(false);
  const lastAct = useRef(Date.now());
  const musicCmd = useRef(() => {});
  const noticeT = useRef();

  const say = (m) => { setNotice(m); clearTimeout(noticeT.current); noticeT.current = setTimeout(() => setNotice(''), 3000); };
  const poke = () => { lastAct.current = Date.now(); setIdle(false); };

  useEffect(() => {
    document.documentElement.classList.add('tv');
    const p = new URLSearchParams(location.search);
    const k = p.get('k');
    if (k && /^[0-9a-f-]{36}$/i.test(k)) { setKitchenId(k); history.replaceState(null, '', location.pathname); }
    setKid(getKitchenId());
    setReady(true);
    const onMouse = () => document.documentElement.classList.add('mouse');
    window.addEventListener('mousemove', onMouse, { once: true });
  }, []);

  const load = useCallback(async () => {
    if (!kid) return;
    try {
      const d = await getKitchen(kid);
      if (d === null) { setKitchenId(null); setKid(null); return; }
      setData(d);
    } catch {}
  }, [kid]);
  useEffect(() => { load(); const iv = setInterval(load, 5 * 60 * 1000); return () => clearInterval(iv); }, [load]);

  const cast = useCast(kid, 'tv', (ev, payload) => {
    if (ev === 'library') load();
    if (ev === 'musicCmd') musicCmd.current(payload?.cmd, payload?.arg);
    if (ev === 'musicInfo') setRemoteInfo(payload);
    if (ev === 'notice') {
      if (payload?.chef) { setChef(payload.chef); poke(); }
      else if (payload?.text) say(payload.text);
    }
  });
  const s = cast.state;
  const recipe = s.recipeId ? data?.recipes?.find((r) => r.id === s.recipeId) : null;
  const screen = recipe ? s.screen : 'home';
  const now = useNow(s.timers?.length > 0);
  const alarms = useAlarms(s.timers, now);

  // כל שינוי מהטלפון מעיר את המסך
  useEffect(() => { poke(); }, [s.v]);
  useEffect(() => {
    const iv = setInterval(() => {
      const busy = screen !== 'home' || s.timers?.length;
      if (!busy && Date.now() - lastAct.current > IDLE_MS) setIdle(true);
    }, 15000);
    return () => clearInterval(iv);
  }, [screen, s.timers?.length]);

  useEffect(() => { if (s.recipeId && data && !recipe) load(); }, [s.recipeId, data, recipe, load]);
  useEffect(() => { const t = setTimeout(() => focusFirst(), 60); return () => clearTimeout(t); }, [screen, s.recipeId, !!data]);

  // השלט של הטלוויזיה
  const keys = useRef();
  keys.current = (e) => {
    const wasIdle = idle;
    poke();
    if (!started) { setStarted(1); unlockAudio(); e.preventDefault(); return; }
    if (wasIdle) { e.preventDefault(); return; }
    if (KEY.isOk(e)) musicCmd.current('play');
    if (alarms.length) {
      if (KEY.isOk(e) || KEY.isBack(e)) { alarms.forEach((t) => removeTimer(cast.update, t.id)); e.preventDefault(); }
      return;
    }
    if (chef && (KEY.isOk(e) || KEY.isBack(e))) { setChef(null); e.preventDefault(); return; }
    if (s.music) {
      if (KEY.isPlay(e)) { setMusic(cast.update, { playing: s.music.playing === false }); e.preventDefault(); return; }
      if (e.key === 'MediaTrackNext' || e.keyCode === 176 || e.keyCode === 417) { musicCmd.current('next'); cast.send('musicCmd', { cmd: 'next' }); e.preventDefault(); return; }
      if (e.key === 'MediaTrackPrevious' || e.keyCode === 177 || e.keyCode === 412) { musicCmd.current('prev'); cast.send('musicCmd', { cmd: 'prev' }); e.preventDefault(); return; }
      if (e.key === 'AudioVolumeUp' || e.keyCode === 447) { setMusic(cast.update, { volume: Math.min(100, (s.music.volume ?? 60) + 10) }); return; }
      if (e.key === 'AudioVolumeDown' || e.keyCode === 448) { setMusic(cast.update, { volume: Math.max(0, (s.music.volume ?? 60) - 10) }); return; }
    }
    const steps = recipe ? flatSteps(recipe) : [];
    if (screen === 'cook') {
      const step = s.step || 0;
      if (KEY.isLeft(e)) { if (step < steps.length - 1) cast.update({ step: step + 1 }); e.preventDefault(); return; }
      if (KEY.isRight(e)) { if (step > 0) cast.update({ step: step - 1 }); e.preventDefault(); return; }
      if (KEY.isOk(e)) {
        const m = steps[step] && detectMinutes(steps[step].text);
        if (m) { addTimer(cast.update, `שלב ${step + 1}: ${steps[step].text.slice(0, 40)}`, m); say('⏱️ טיימר הופעל'); }
        e.preventDefault();
        return;
      }
      if (KEY.isDown(e)) { cast.update({ screen: 'ingredients' }); e.preventDefault(); return; }
      if (KEY.isBack(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
      if (KEY.isUp(e)) { e.preventDefault(); return; }
    }
    if (screen === 'original') {
      const page = s.page || 0, n = recipe?.source_images?.length || 0;
      if (KEY.isLeft(e)) { if (page < n - 1) cast.update({ page: page + 1 }); e.preventDefault(); return; }
      if (KEY.isRight(e)) { if (page > 0) cast.update({ page: page - 1 }); e.preventDefault(); return; }
      if (KEY.isBack(e) || KEY.isOk(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
    }
    if (screen === 'ingredients' && KEY.isBack(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
    if (screen === 'recipe' && KEY.isBack(e)) { cast.update({ screen: 'home', recipeId: null }); e.preventDefault(); return; }
    const el = document.activeElement;
    if (el?.hasAttribute?.('data-scroll') && (KEY.isUp(e) || KEY.isDown(e))) {
      const dy = el.clientHeight * 0.4 * (KEY.isDown(e) ? 1 : -1);
      const atEdge = dy > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 0;
      if (!atEdge) { el.scrollBy({ top: dy, behavior: 'smooth' }); e.preventDefault(); return; }
    }
    const dir = KEY.isLeft(e) ? 'left' : KEY.isRight(e) ? 'right' : KEY.isUp(e) ? 'up' : KEY.isDown(e) ? 'down' : null;
    if (dir) { moveFocus(dir); e.preventDefault(); }
  };
  useEffect(() => {
    const h = (e) => keys.current?.(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!ready) return null;

  if (!kid) return <TvPair onKitchen={(id) => { setKitchenId(id); setKid(id); setStarted(1); }} />;

  const phones = cast.peers.filter((p) => p.role === 'phone').length;
  const doneAlarm = alarms[0];
  const start = () => { setStarted((x) => x + 1); unlockAudio(); poke(); };

  return (
    <div className="tvs" onClick={start}>
      <div className="tv-top">
        <span className="brand">🍳 {data?.kitchen?.name || 'מתכונים בגדול'}</span>
        <span style={{ flex: 1 }} />
        <span className={'tv-badge' + (phones ? ' on' : '')}><span className="dot" style={{ width: '.6rem', height: '.6rem', borderRadius: '50%', background: 'currentColor' }} />{phones ? (phones > 1 ? `${phones} טלפונים מחוברים` : 'הטלפון מחובר') : cast.online ? 'ממתין לטלפון' : 'מתחבר...'}</span>
        <Clock />
      </div>
      <div className="tv-main">
        {!data && <p style={{ fontSize: '1.6rem', color: 'var(--muted)', textAlign: 'center', marginTop: '20vh' }}>טוען מתכונים...</p>}
        {data && screen === 'home' && <TvHome data={data} cast={cast} />}
        {data && screen === 'recipe' && recipe && <TvRecipe recipe={recipe} cast={cast} />}
        {data && screen === 'cook' && recipe && <TvCook recipe={recipe} cast={cast} />}
        {data && screen === 'ingredients' && recipe && <TvIngredients recipe={recipe} cast={cast} />}
        {data && screen === 'original' && recipe && <TvOriginal recipe={recipe} cast={cast} />}
      </div>

      <TvTimers timers={s.timers} now={now} />
      <TvMusic cast={cast} cmdRef={musicCmd} started={started} duck={alarms.length > 0} remoteInfo={remoteInfo} />
      {chef && <TvChef chef={chef} onClose={() => setChef(null)} />}

      {doneAlarm && (
        <div className="tv-alarm">
          <div className="ring">🔔</div>
          <h2>הטיימר נגמר!</h2>
          <p>{doneAlarm.label}</p>
          <button className="tv-btn primary" data-nav="" onClick={() => alarms.forEach((t) => removeTimer(cast.update, t.id))}>אישור (OK)</button>
        </div>
      )}

      {idle && started > 0 && !doneAlarm && <TvIdle data={data} />}

      {!started && (
        <div className="tv-start">
          <div className="logo">🍳</div>
          <h1>{data?.kitchen?.name || 'מתכונים בגדול'}</h1>
          <p>לחצו OK בשלט כדי להתחיל (כך יופעלו גם הצלילים והמוזיקה)</p>
          <button className="tv-btn primary" onClick={start}>התחלה</button>
        </div>
      )}
      {notice && <div className="tv-notice">{notice}</div>}
    </div>
  );
}
