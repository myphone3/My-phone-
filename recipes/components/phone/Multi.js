'use client';
// בישול כמה מתכונים במקביל (למשל ארוחת שישי): לכל מתכון השלב שלו, הכל מסונכרן לטלוויזיה
import { useEffect, useState } from 'react';
import { flatSteps, detectMinutes, fmtMinutes } from '@/lib/recipe';
import { addTimer } from '@/lib/timers';
import { Sheet, Timers, emojiFor, metaLine } from './ui';

export const startMulti = (cast, ids) => cast.update({ screen: 'multi', recipeId: null, multi: { ids: ids.slice(0, 4), steps: {}, focus: ids[0] } });

export function MultiPickSheet({ recipes, cast, onClose, replace, preset }) {
  const [sel, setSel] = useState(preset || []);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 4 ? [...s, id] : s));
  return (
    <Sheet onClose={onClose}>
      <h3>🍽️ כמה מתכונים יחד</h3>
      <p className="muted small" style={{ marginTop: -6 }}>בחרו עד 4 מתכונים. בטלוויזיה כל מתכון יקבל עמודה עם השלב שלו והטיימרים שלו.</p>
      <div className="pick">
        {recipes.map((r) => (
          <button key={r.id} className={'music-item' + (sel.includes(r.id) ? ' on' : '')} onClick={() => toggle(r.id)}>
            <span className="mthumb">{r.image_url ? <img src={r.image_url} alt="" /> : emojiFor(r)}</span>
            <span className="grow"><b className="mt">{r.title}</b><small className="muted">{metaLine(r)}</small></span>
            <span style={{ fontSize: 20 }}>{sel.includes(r.id) ? '✅' : '⬜'}</span>
          </button>
        ))}
      </div>
      <button className="btn primary big block" style={{ marginTop: 12 }} disabled={sel.length < 2} onClick={() => { startMulti(cast, sel); replace({ name: 'multi' }); }}>
        {sel.length < 2 ? 'בחרו לפחות 2 מתכונים' : `👩‍🍳 מתחילים (${sel.length})`}
      </button>
    </Sheet>
  );
}

export function MultiView({ recipes, cast, back, now, openSheet }) {
  const m = cast.state.multi;
  const list = (m?.ids || []).map((id) => recipes.find((r) => r.id === id)).filter(Boolean);
  const [tab, setTab] = useState(m?.focus || list[0]?.id);
  useEffect(() => { if (m?.focus && m.focus !== tab) setTab(m.focus); }, [m?.focus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cast.state.screen !== 'multi' && m) cast.update({ screen: 'multi' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // המסך לא נכבה
  useEffect(() => {
    let lock;
    (async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch {} })();
    return () => { try { lock?.release(); } catch {} };
  }, []);

  if (!m || !list.length) {
    return <div className="wrap empty"><div className="e">🍽️</div><h3>אין בישול משותף פעיל</h3><button className="btn" onClick={back}>חזרה</button></div>;
  }
  const r = list.find((x) => x.id === tab) || list[0];
  const steps = flatSteps(r);
  const step = Math.min(m.steps?.[r.id] || 0, Math.max(0, steps.length - 1));
  const cur = steps[step];
  const minutes = cur ? detectMinutes(cur.text) : null;
  const setStep = (i) => cast.update((s) => ({ multi: { ...s.multi, focus: r.id, steps: { ...(s.multi?.steps || {}), [r.id]: Math.max(0, Math.min(steps.length - 1, i)) } } }));
  const focus = (id) => { setTab(id); cast.update((s) => ({ multi: { ...s.multi, focus: id } })); };

  return (
    <div className="wrap cook">
      <div className="top">
        <div className="row">
          <button className="icon-btn" onClick={back} aria-label="חזרה">→</button>
          <h1 className="h1 grow" style={{ fontSize: 19 }}>🍽️ בישול משותף</h1>
          <button className="icon-btn" onClick={() => openSheet('music')} aria-label="מוזיקה">🎵</button>
          <button className="btn danger" style={{ minHeight: 40 }} onClick={() => { if (confirm('לסיים את הבישול המשותף?')) { cast.update({ screen: 'home', multi: null }); back(); } }}>סיום</button>
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {list.map((x) => {
            const st = flatSteps(x);
            const i = (m.steps?.[x.id] || 0) + 1;
            return <button key={x.id} className={'chip' + (x.id === r.id ? ' on' : '')} style={{ height: 42 }} onClick={() => focus(x.id)}>{emojiFor(x)} {x.title.slice(0, 18)} · {i}/{st.length}</button>;
          })}
        </div>
      </div>

      <div className="prog"><i style={{ width: `${steps.length ? ((step + 1) / steps.length) * 100 : 0}%` }} /></div>
      <div className="row small muted"><span className="grow">{r.title} — שלב {step + 1} מתוך {steps.length}</span>{cur?.section && <span className="sec">{cur.section}</span>}</div>
      <div className="stepbig">{cur?.text || 'אין שלבים'}</div>
      {minutes && <button className="btn soft big block" onClick={() => addTimer(cast.update, `${r.title.slice(0, 18)}: ${fmtMinutes(minutes)}`, minutes)}>⏱️ טיימר ל-{fmtMinutes(minutes)}</button>}

      <div style={{ marginTop: 14 }}><Timers timers={cast.state.timers} update={cast.update} now={now} /></div>

      <div className="navbtns">
        <button className="btn big" disabled={step === 0} onClick={() => setStep(step - 1)}>→ הקודם</button>
        <button className="btn primary big" disabled={step >= steps.length - 1} onClick={() => setStep(step + 1)}>{step >= steps.length - 1 ? '✓ המתכון הזה מוכן' : 'השלב הבא ←'}</button>
      </div>
    </div>
  );
}
