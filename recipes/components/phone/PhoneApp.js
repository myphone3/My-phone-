'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createKitchen, getKitchen } from '@/lib/api';
import { useCast, pairTv } from '@/lib/cast';
import { getKitchenId, setKitchenId, read, write } from '@/lib/local';
import { useNow, useAlarms } from '@/lib/timers';
import { unlockAudio } from '@/lib/sound';
import { Timers } from './ui';
import Library from './Library';
import RecipeView from './RecipeView';
import CookView from './CookView';
import Editor from './Editor';
import AddSheet from './AddSheet';
import MusicSheet from './MusicSheet';
import TvSheet from './TvSheet';
import SettingsSheet from './SettingsSheet';
import MiniPlayer from './MiniPlayer';
import ChefSheet from './ChefSheet';
import { PlanView, PlanAddSheet, PlanPickSheet } from './Plan';

function Welcome({ onCreate, busy }) {
  const [name, setName] = useState('המתכונים של המשפחה');
  return (
    <div className="wrap" style={{ paddingTop: 60, textAlign: 'center' }}>
      <div style={{ fontSize: 72 }}>🍳📺</div>
      <h1 className="h1" style={{ whiteSpace: 'normal', fontSize: 30, margin: '14px 0 8px' }}>מתכונים בגדול</h1>
      <p className="muted" style={{ fontSize: 17, margin: '0 0 28px' }}>
        כל המתכונים שלכם מה-PDF ומהתמונות, מסודרים יפה לפי שלבים — ומוצגים בגדול על הטלוויזיה, בלי שיקוף מסך.
      </p>
      <label className="f" style={{ textAlign: 'start' }}>איך לקרוא לספר המתכונים?</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn primary big block" style={{ marginTop: 16 }} disabled={busy} onClick={() => onCreate(name)}>
        {busy ? 'יוצרים...' : 'להתחיל'}
      </button>
      <p className="muted small" style={{ marginTop: 18 }}>קיבלתם קישור משפחתי? פשוט פתחו אותו והמתכונים יופיעו כאן.</p>
    </div>
  );
}

export default function PhoneApp() {
  const [kitchenId, setKid] = useState(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [view, setView] = useState({ name: 'library' });
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [follow, setFollowState] = useState(true);
  const [musicInfo, setMusicInfo] = useState(null);
  const pairCode = useRef(null);
  const toastT = useRef();

  const say = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const load = useCallback(async (id = kitchenId) => {
    if (!id) return;
    try {
      const d = await getKitchen(id);
      if (!d) { say('ספר המתכונים לא נמצא'); return; }
      setData(d);
    } catch {
      say('אין חיבור כרגע, נסו שוב');
    }
  }, [kitchenId, say]);

  const cast = useCast(kitchenId, 'phone', (ev, payload) => {
    if (ev === 'library') load();
    if (ev === 'musicInfo') setMusicInfo(payload);
    if (ev === 'musicCmd') window.dispatchEvent(new CustomEvent('rc-music-remote', { detail: payload }));
  });

  // פתיחה: קישור משפחתי (?k=) או קוד מהטלוויזיה (?pair=)
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const k = p.get('k');
    if (k && /^[0-9a-f-]{36}$/i.test(k)) setKitchenId(k);
    const code = p.get('pair');
    if (code && /^\d{6}$/.test(code)) pairCode.current = code;
    if (k || code) history.replaceState(null, '', location.pathname);
    setKid(getKitchenId());
    setFollowState(read('rc_follow', true));
    setReady(true);
    history.replaceState({ name: 'library' }, '');
    const onPop = (e) => setView(e.state || { name: 'library' });
    window.addEventListener('popstate', onPop);
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => { if (kitchenId) load(kitchenId); }, [kitchenId, load]);

  useEffect(() => {
    if (!kitchenId || !pairCode.current) return;
    const code = pairCode.current;
    pairCode.current = null;
    say('מחברים את הטלוויזיה...');
    pairTv(code, kitchenId).then((ok) => say(ok ? '📺 הטלוויזיה מחוברת!' : 'לא הצלחנו להתחבר. בדקו שהקוד על המסך עדיין מופיע'));
  }, [kitchenId, say]);

  const go = useCallback((v) => { history.pushState(v, ''); setView(v); window.scrollTo(0, 0); }, []);
  const replace = useCallback((v) => { history.replaceState(v, ''); setView(v); window.scrollTo(0, 0); }, []);
  const back = useCallback(() => history.back(), []);
  const openSheet = useCallback((sheet, extra = {}) => go({ ...view, sheet, ...extra }), [go, view]);

  const setFollow = (v) => { setFollowState(v); write('rc_follow', v); };
  const changed = useCallback(async () => { await load(); cast.send('library'); }, [load, cast]);

  const create = async (name) => {
    setBusy(true);
    try {
      const id = await createKitchen(name);
      setKitchenId(id);
      setKid(id);
    } catch {
      say('לא הצלחנו ליצור, בדקו את החיבור לאינטרנט');
    }
    setBusy(false);
  };

  const recipes = data?.recipes || [];
  const byId = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const now = useNow(cast.state.timers?.length > 0);
  const alarms = useAlarms(cast.state.timers, now);

  if (!ready) return null;
  if (!kitchenId) return <Welcome onCreate={create} busy={busy} />;

  const common = { kitchenId, data, recipes, cast, go, back, replace, openSheet, say, changed, follow, now };
  const recipe = view.id ? byId[view.id] : null;
  const showFloatTimers = cast.state.timers?.length > 0 && view.name !== 'cook';

  return (
    <>
      {view.name === 'library' && <Library {...common} />}
      {view.name === 'recipe' && (recipe ? <RecipeView {...common} recipe={recipe} /> : <Missing back={back} loading={!data} />)}
      {view.name === 'cook' && (recipe ? <CookView {...common} recipe={recipe} /> : <Missing back={back} loading={!data} />)}
      {view.name === 'edit' && <Editor {...common} draft={view.draft || byId[view.editId]} />}
      {view.name === 'plan' && <PlanView {...common} />}

      {showFloatTimers && (
        <div className="float-timers"><Timers timers={cast.state.timers} update={cast.update} now={now} /></div>
      )}

      {view.sheet === 'add' && <AddSheet {...common} onClose={back} />}
      {view.sheet === 'music' && <MusicSheet {...common} info={musicInfo} onClose={back} />}
      {view.sheet === 'tv' && <TvSheet {...common} onClose={back} />}
      {view.sheet === 'chef' && recipe && <ChefSheet recipe={recipe} cast={cast} step={view.step} initial={view.q} onClose={back} />}
      {view.sheet === 'plan-add' && recipe && <PlanAddSheet {...common} recipe={recipe} onClose={back} />}
      {view.sheet === 'plan-pick' && <PlanPickSheet {...common} day={view.day} dayLabel={view.dayLabel} onClose={back} />}
      {view.sheet === 'settings' && <SettingsSheet {...common} setFollow={setFollow} onClose={back} onLeave={() => { setKitchenId(null); setKid(null); setData(null); }} />}
      <MiniPlayer cast={cast} info={musicInfo} setInfo={setMusicInfo} duck={alarms.length > 0} hidden={view.name === 'edit'}
        openMusic={() => (view.sheet === 'music' ? null : openSheet('music'))} />
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Missing({ back, loading }) {
  return (
    <div className="wrap empty">
      {loading ? <div className="spinner" /> : <><div className="e">🤔</div><h3>המתכון לא נמצא</h3><button className="btn" onClick={back}>חזרה</button></>}
    </div>
  );
}
