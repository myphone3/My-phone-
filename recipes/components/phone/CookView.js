'use client';
import { useEffect, useState } from 'react';
import { flatSteps, detectMinutes, fmtMinutes, ingredientsForStep, scaleText } from '@/lib/recipe';
import { useRecipeSession } from '@/lib/session';
import { addTimer } from '@/lib/timers';
import { markCooked } from '@/lib/api';
import { Timers } from './ui';

export default function CookView({ recipe, cast, follow, back, now, kitchenId, say, openSheet }) {
  const { s, set, active, show } = useRecipeSession(cast, recipe, follow);
  const steps = flatSteps(recipe);
  const step = Math.min(s.step || 0, Math.max(0, steps.length - 1));
  const cur = steps[step];
  const minutes = cur ? detectMinutes(cur.text) : null;
  const base = Number(recipe.servings) || null;
  const factor = base && s.servings ? s.servings / base : 1;
  const used = cur ? ingredientsForStep(recipe, cur.text) : [];
  const onTv = cast.tvOnline && active;
  const tvScreen = active ? cast.state.screen : null;
  const [custom, setCustom] = useState('');
  const finished = step >= steps.length - 1;

  // המסך לא נכבה בזמן בישול
  useEffect(() => {
    let lock;
    const req = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch {} };
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); try { lock?.release(); } catch {} };
  }, []);

  // כשנכנסים למצב בישול — גם הטלוויזיה עוברת לשלבים
  useEffect(() => {
    if (active && cast.state.screen !== 'cook' && cast.state.screen !== 'original') cast.update({ screen: 'cook' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const goStep = (i) => set({ step: Math.max(0, Math.min(steps.length - 1, i)) });
  const timerLabel = cur ? `שלב ${step + 1}: ${cur.text.slice(0, 40)}` : 'טיימר';
  const done = async () => {
    try { await markCooked(kitchenId, recipe.id); } catch {}
    say('בתיאבון! 🎉');
    if (active) cast.update({ screen: 'recipe' });
    back();
  };

  if (!steps.length) {
    return <div className="wrap empty"><div className="e">📝</div><h3>אין שלבים במתכון</h3><button className="btn" onClick={back}>חזרה</button></div>;
  }

  return (
    <div className="wrap cook">
      <div className="top">
        <div className="row">
          <button className="icon-btn" onClick={() => { if (active && cast.state.screen === 'cook') cast.update({ screen: 'recipe' }); back(); }} aria-label="חזרה">→</button>
          <div className="grow">
            <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
            <div className="small muted">{onTv ? '📺 שולטים בטלוויזיה מהטלפון' : 'מצב בישול'}</div>
          </div>
          <button className="icon-btn" onClick={() => openSheet('music')} aria-label="מוזיקה">🎵</button>
        </div>
        <div className="prog"><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="row small muted"><span className="grow">שלב {step + 1} מתוך {steps.length}</span>{cur?.section && <span className="sec">{cur.section}</span>}</div>
      </div>

      {cast.tvOnline && (
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={tvScreen === 'recipe' ? 'on' : ''} onClick={() => show('recipe', { step })}>מתכון מלא</button>
          <button className={tvScreen === 'cook' ? 'on' : ''} onClick={() => show('cook', { step })}>שלב בגדול</button>
          {recipe.source_images?.length > 0 && <button className={tvScreen === 'original' ? 'on' : ''} onClick={() => show('original', { step })}>המקור</button>}
        </div>
      )}

      {cur?.section && <div className="sec">{cur.section}</div>}
      <div className="stepbig">{cur?.text}</div>

      {minutes && (
        <button className="btn soft big block" onClick={() => addTimer(cast.update, timerLabel, minutes)}>⏱️ הפעלת טיימר ל-{fmtMinutes(minutes)}</button>
      )}

      {used.length > 0 && (
        <div className="box" style={{ marginTop: 14 }}>
          <div className="group-t">צריך בשלב הזה</div>
          {used.map((u) => <div key={u.key} className="ing" style={{ padding: '6px 0' }}><span>• {scaleText(u.item, factor)}</span></div>)}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Timers timers={cast.state.timers} update={cast.update} now={now} />
        <div className="row" style={{ marginTop: 10 }}>
          <input type="number" inputMode="numeric" min="1" placeholder="טיימר בדקות" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ height: 46 }} />
          <button className="btn" disabled={!(+custom > 0)} onClick={() => { addTimer(cast.update, 'טיימר ' + custom + " דק'", +custom); setCustom(''); }}>＋ טיימר</button>
        </div>
      </div>

      <div className="chips" style={{ marginTop: 16 }}>
        {steps.map((st, i) => (
          <button key={i} className={'chip' + (i === step ? ' on' : '')} onClick={() => goStep(i)} style={{ minWidth: 40, justifyContent: 'center' }}>{i + 1}</button>
        ))}
      </div>

      <div className="navbtns">
        <button className="btn big" disabled={step === 0} onClick={() => goStep(step - 1)}>→ הקודם</button>
        {finished
          ? <button className="btn herb big" onClick={done}>✓ סיימתי!</button>
          : <button className="btn primary big" onClick={() => goStep(step + 1)}>השלב הבא ←</button>}
      </div>
    </div>
  );
}
