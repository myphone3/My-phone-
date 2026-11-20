'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getKitchen } from '@/lib/api';
import { useCast } from '@/lib/cast';
import { getKitchenId, setKitchenId } from '@/lib/local';
import { KEY, moveFocus, focusFirst } from '@/lib/spatial';
import { flatSteps } from '@/lib/recipe';
import { useNow, useAlarms, removeTimer } from '@/lib/timers';
import { unlockAudio } from '@/lib/sound';
import { setMusic } from '@/lib/music';
import { TvPair, TvHome, TvRecipe, TvCook, TvOriginal, TvTimers, TvIngredients, TvChef, TvIdle, TvBoard, TvMulti, Clock } from './TvScreens';
import TvMusic from './TvMusic';
import { useKeepAwake } from '@/lib/awake';
import { cachedKitchen, storeKitchen } from '@/lib/offline';

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
  const [offline, setOffline] = useState(false);
  const lastAct = useRef(Date.now());
  const musicCmd = useRef(() => {});
  const noticeT = useRef();

  useKeepAwake(true);
  const say = (m) => { setNotice(m); clearTimeout(noticeT.current); noticeT.current = setTimeout(() => setNotice(''), 3000); };
  const poke = () => { lastAct.current = Date.now(); setIdle(false); };

  useEffect(() => {
    document.documentElement.classList.add('tv');
    const p = new URLSearchParams(location.search);
    const k = p.get('k');
    if (k && /^[0-9a-f-]{36}$/i.test(k)) { setKitchenId(k); history.replaceState(null, '', location.pathname); }
    const id = getKitchenId();
    setData(cachedKitchen(id));
    setKid(id);
    setReady(true);
    const onMouse = () => document.documentElement.classList.add('mouse');
    window.addEventListener('mousemove', onMouse, { once: true });
  }, []);

  const load = useCallback(async () => {
    if (!kid) return;
    setData((cur) => cur || cachedKitchen(kid));
    try {
      const d = await getKitchen(kid);
      if (d === null) { setKitchenId(null); setKid(null); return; }
      setData(d);
      setOffline(false);
      storeKitchen(kid, d);
    } catch { setOffline(true); }
  }, [kid]);
  useEffect(() => {
    const on = () => load();
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load]);
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
  const screen = s.screen === 'multi' && s.multi?.ids?.length ? 'multi' : recipe ? s.screen : 'home';
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const now = useNow(s.timers?.length > 0);
  const alarms = useAlarms(s.timers, now);

  // כל שינוי מהטלפון מעיר את המסך
  useEffect(() => { poke(); }, [s.v]);
  useEffect(() => {
    const iv = setInterval(() => {
      const busy = screen !== 'home' || s.timers?.length;
      if (s.saver && !busy && Date.now() - lastAct.current > IDLE_MS) setIdle(true);
    }, 15000);
    return () => clearInterval(iv);
  }, [screen, s.timers?.length, s.saver]);

  // עדכון באתר → הטלוויזיה מתרעננת לבד, רק ברגע שקט (במסך הבית / שומר מסך, בלי טיימרים ובלי מוזיקה שמנגנת בטלוויזיה)
  const quiet = useRef(false);
  quiet.current = (screen === 'home' || idle) && !s.timers?.length && !(s.music && s.music.output === 'tv' && s.music.playing !== false);
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD;
    if (!mine) return;
    let fresh = false;
    const iv = setInterval(async () => {
      try {
        if (!fresh) { const r = await fetch('/api/version', { cache: 'no-store' }); const { build } = await r.json(); fresh = !!build && build !== mine; }
        if (fresh && quiet.current && Date.now() - lastAct.current > 60000) location.reload();
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

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
      // החצים עוברים בין הכפתורים שעל המסך ו-OK לוחץ על המסומן ("השלב הבא" מסומן מראש)
      const step = s.step || 0;
      const el = document.activeElement;
      if (KEY.isOk(e) && !el?.hasAttribute?.('data-nav')) { if (step < steps.length - 1) cast.update({ step: step + 1 }); e.preventDefault(); return; }
      if (KEY.isBack(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
    }
    if (screen === 'original') {
      const page = s.page || 0, n = recipe?.source_images?.length || 0;
      if (KEY.isLeft(e)) { if (page < n - 1) cast.update({ page: page + 1 }); e.preventDefault(); return; }
      if (KEY.isRight(e)) { if (page > 0) cast.update({ page: page - 1 }); e.preventDefault(); return; }
      if (KEY.isBack(e) || KEY.isOk(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
    }
    if (screen === 'multi') {
      const m = s.multi, ids = m.ids, fi = Math.max(0, ids.indexOf(m.focus));
      const rec = data?.recipes?.find((r) => r.id === ids[fi]);
      const n = rec ? flatSteps(rec).length : 0, cur = m.steps?.[ids[fi]] || 0;
      const setStep = (v) => cast.update({ multi: { ...m, steps: { ...(m.steps || {}), [ids[fi]]: Math.max(0, Math.min(n - 1, v)) } } });
      if (KEY.isLeft(e)) { cast.update({ multi: { ...m, focus: ids[Math.min(ids.length - 1, fi + 1)] } }); e.preventDefault(); return; }
      if (KEY.isRight(e)) { cast.update({ multi: { ...m, focus: ids[Math.max(0, fi - 1)] } }); e.preventDefault(); return; }
      if (KEY.isOk(e) || KEY.isDown(e)) { setStep(cur + 1); e.preventDefault(); return; }
      if (KEY.isUp(e)) { setStep(cur - 1); e.preventDefault(); return; }
      if (KEY.isBack(e)) { cast.update({ screen: 'home', multi: null }); e.preventDefault(); return; }
    }
    if (screen === 'board') {
      if (KEY.isBack(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
      if (KEY.isOk(e)) { cast.update({ screen: 'cook' }); e.preventDefault(); return; }
      e.preventDefault();
      return;
    }
    if (screen === 'ingredients' && KEY.isBack(e)) { cast.update({ screen: 'recipe' }); e.preventDefault(); return; }
    if (screen === 'recipe' && KEY.isBack(e)) { cast.update({ screen: 'home', recipeId: null }); e.preventDefault(); return; }
    const el = document.activeElement;
    if (el?.hasAttribute?.('data-scroll') && (KEY.isUp(e) || KEY.isDown(e))) {
      const dy = el.clientHeight * 0.4 * (KEY.isDown(e) ? 1 : -1);
      const atEdge = dy > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 0;
      if (!atEdge) { el.scrollBy({ top: dy, behavior: e.repeat ? 'auto' : 'smooth' }); e.preventDefault(); return; }
    }
    const dir = KEY.isLeft(e) ? 'left' : KEY.isRight(e) ? 'right' : KEY.isUp(e) ? 'up' : KEY.isDown(e) ? 'down' : null;
    if (dir) { moveFocus(dir, e.repeat); e.preventDefault(); }
  };
  // אפליקציית אנדרואיד: כפתור חזור. מחזיר false במסך הבית כדי שהאפליקציה תצא
  useEffect(() => {
    window.__tvBack = () => {
      const ev = new KeyboardEvent('keydown', { key: 'Escape' });
      const before = JSON.stringify([screenRef.current, !!document.querySelector('.tv-alarm,.tv-chef,.tv-idle,.tv-start')]);
      if (screenRef.current === 'home' && before.endsWith('false]')) return false;
      keys.current?.(ev);
      return true;
    };
    if (/MatkonimTV/.test(navigator.userAgent)) setStarted((x) => x || 1);
    return () => { delete window.__tvBack; };
  }, []);
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
    <div className={'tvs' + (s.music ? ' has-music' : '')} onClick={start}>
      <div className="tv-top">
        <span className="brand">🍳 {data?.kitchen?.name || 'מתכונים בגדול'}</span>
        <span style={{ flex: 1 }} />
        <div className="tv-isle-row">
          <TvMusic cast={cast} cmdRef={musicCmd} started={started} duck={alarms.length > 0} remoteInfo={remoteInfo} />
          <TvTimers timers={s.timers} now={now} />
        </div>
        <span style={{ flex: 1 }} />
        <span className={'tv-badge' + (phones ? ' on' : '')}><span className="dot" style={{ width: '.6rem', height: '.6rem', borderRadius: '50%', background: 'currentColor' }} />{offline ? '📴 בלי אינטרנט — מתכונים שמורים' : phones ? (phones > 1 ? `${phones} טלפונים מחוברים` : 'הטלפון מחובר') : cast.online ? 'ממתין לטלפון' : 'מתחבר...'}</span>
        <Clock />
      </div>
      <div className="tv-main">
        {!data && <p style={{ fontSize: '1.6rem', color: 'var(--muted)', textAlign: 'center', marginTop: '20vh' }}>טוען מתכונים...</p>}
        {data && screen === 'home' && <TvHome data={data} cast={cast} />}
        {data && screen === 'recipe' && recipe && <TvRecipe recipe={recipe} cast={cast} />}
        {data && screen === 'cook' && recipe && <TvCook recipe={recipe} cast={cast} />}
        {data && screen === 'ingredients' && recipe && <TvIngredients recipe={recipe} cast={cast} />}
        {data && screen === 'multi' && <TvMulti data={data} cast={cast} now={now} />}
        {data && screen === 'board' && recipe && <TvBoard recipe={recipe} cast={cast} />}
        {data && screen === 'original' && recipe && <TvOriginal recipe={recipe} cast={cast} />}
      </div>

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
