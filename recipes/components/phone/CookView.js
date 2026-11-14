'use client';
import { useEffect, useRef, useState } from 'react';
import { flatSteps, detectMinutes, fmtMinutes, ingredientsForStep, scaleText } from '@/lib/recipe';
import { useRecipeSession } from '@/lib/session';
import { addTimer } from '@/lib/timers';
import { markCooked } from '@/lib/api';
import { read, write } from '@/lib/local';
import { setMusic, musicCmd } from '@/lib/music';
import { useVoice, speak, stopSpeaking, canListen, canSpeak } from '@/lib/voice';
import { Timers } from './ui';

export default function CookView({ recipe, cast, follow, back, now, kitchenId, say, openSheet, changed }) {
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
  const [voiceOn, setVoiceOn] = useState(false);
  const [readOn, setReadOn] = useState(false);
  const finished = step >= steps.length - 1;
  const timerLabel = cur ? `שלב ${step + 1}: ${cur.text.slice(0, 40)}` : 'טיימר';
  const m = cast.state.music;

  useEffect(() => { setVoiceOn(read('rc_voice', false)); setReadOn(read('rc_read', false)); }, []);

  // המסך לא נכבה בזמן בישול
  useEffect(() => {
    let lock;
    const req = async () => { try { lock = await navigator.wakeLock?.request('screen'); } catch {} };
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); try { lock?.release(); } catch {} stopSpeaking(); };
  }, []);

  useEffect(() => {
    if (active && !['cook', 'original', 'ingredients'].includes(cast.state.screen)) cast.update({ screen: 'cook' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // הקראת השלב בכל מעבר
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; if (!readOn) return; }
    if (readOn && cur) speak(`שלב ${step + 1}. ${cur.text}`);
  }, [step, readOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const goStep = (i) => set({ step: Math.max(0, Math.min(steps.length - 1, i)) });

  const { listening, heard } = useVoice(voiceOn, (c) => {
    if (c.cmd === 'next') { if (!finished) goStep(step + 1); else say('זה השלב האחרון'); }
    if (c.cmd === 'prev') goStep(step - 1);
    if (c.cmd === 'repeat' && cur) speak(cur.text);
    if (c.cmd === 'timer') {
      const mins = c.minutes || minutes;
      if (mins) { addTimer(cast.update, c.minutes ? `טיימר ${mins} דק'` : timerLabel, mins); speak(`טיימר ל-${mins} דקות`); } else speak('כמה דקות? תגידו למשל טיימר 10 דקות');
    }
    if (c.cmd === 'pause' && m) setMusic(cast.update, { playing: false });
    if (c.cmd === 'play' && m) setMusic(cast.update, { playing: true });
    if (c.cmd === 'song' && m) musicCmd(cast, 'next');
    if (c.cmd === 'ingredients') show('ingredients', { step });
    if (c.cmd === 'ask') openSheet('chef', { q: c.text, step: cur?.text });
  });

  const toggleVoice = () => {
    if (!canListen()) { say('הטלפון הזה לא תומך בשליטה קולית (נסו בכרום)'); return; }
    write('rc_voice', !voiceOn); setVoiceOn(!voiceOn);
  };
  const toggleRead = () => {
    if (!canSpeak()) { say('הטלפון הזה לא תומך בהקראה'); return; }
    write('rc_read', !readOn); setReadOn(!readOn);
    if (!readOn && cur) speak(cur.text); else stopSpeaking();
  };

  const done = async () => {
    try { await markCooked(kitchenId, recipe.id); await changed(); } catch {}
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
          <button className="icon-btn" onClick={() => { if (active && cast.state.screen !== 'recipe') cast.update({ screen: 'recipe' }); back(); }} aria-label="חזרה">→</button>
          <div className="grow">
            <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recipe.title}</div>
            <div className="small muted">{onTv ? '📺 שולטים בטלוויזיה מהטלפון' : 'מצב בישול'}</div>
          </div>
          <button className={'icon-btn' + (voiceOn ? ' on' : '')} onClick={toggleVoice} aria-label="שליטה קולית">🎙️</button>
          <button className={'icon-btn' + (readOn ? ' on' : '')} onClick={toggleRead} aria-label="הקראה">🔊</button>
        </div>
        <div className="prog"><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <div className="row small muted"><span className="grow">שלב {step + 1} מתוך {steps.length}</span>{cur?.section && <span className="sec">{cur.section}</span>}</div>
      </div>

      {voiceOn && (
        <div className="voice">
          <span className="mic" />
          <span className="grow">{listening ? 'מקשיב... אמרו ״הבא״, ״הקודם״, ״טיימר 5 דקות״, ״תקריא״ או שאלה לשף' : 'מפעיל מיקרופון...'}</span>
          {heard && <span className="muted" style={{ fontSize: 12 }}>״{heard.slice(0, 24)}״</span>}
        </div>
      )}

      {cast.tvOnline && (
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={tvScreen === 'cook' ? 'on' : ''} onClick={() => show('cook', { step })}>שלב בגדול</button>
          <button className={tvScreen === 'ingredients' ? 'on' : ''} onClick={() => show('ingredients', { step })}>מצרכים</button>
          <button className={tvScreen === 'recipe' ? 'on' : ''} onClick={() => show('recipe', { step })}>מתכון מלא</button>
          {recipe.source_images?.length > 0 && <button className={tvScreen === 'original' ? 'on' : ''} onClick={() => show('original', { step })}>מקור</button>}
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
        <div className="presets">
          {[1, 3, 5, 10, 15, 20, 30, 45, 60].map((n) => (
            <button key={n} onClick={() => addTimer(cast.update, `טיימר ${fmtMinutes(n)}`, n)}>{n < 60 ? `${n} דק'` : 'שעה'}</button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="number" inputMode="numeric" min="1" placeholder="טיימר אחר (דקות)" value={custom} onChange={(e) => setCustom(e.target.value)} style={{ height: 44 }} />
          <button className="btn" disabled={!(+custom > 0)} onClick={() => { addTimer(cast.update, 'טיימר ' + fmtMinutes(+custom), +custom); setCustom(''); }}>＋ טיימר</button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className="btn grow" onClick={() => openSheet('chef', { step: cur?.text })}>👩‍🍳 שאלה לשף</button>
        <button className="btn grow" onClick={() => openSheet('music')}>🎵 מוזיקה</button>
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
