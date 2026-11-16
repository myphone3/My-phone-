'use client';
import { useEffect, useState } from 'react';
import { unlock, setPin, hasBio, checkBio, getToken } from '@/lib/lock';

// מסך הנעילה של הארכיון.
// needPin: אין לטלפון הזה כניסה בתוקף — חייבים קוד (פעם ראשונה במכשיר, או אחרי שהקוד הוחלף)
export default function LockScreen({ vault, needPin, onOpen }) {
  const [mode, setMode] = useState('pin'); // pin | recover | newpin
  const bio = !needPin && !!getToken(vault.id) && hasBio(vault.id);

  if (mode === 'recover') return <Recover vault={vault} onBack={() => setMode('pin')} onOk={() => setMode('newpin')} />;
  if (mode === 'newpin') return <NewPin vault={vault} onDone={onOpen} onCancel={onOpen} />;

  return (
    <PinPad
      title={`🔒 ${vault.name}`}
      sub={needPin ? 'הארכיון נעול בקוד — הקלד אותו כדי להיכנס' : 'הקלד את הקוד'}
      bio={bio ? () => checkBio(vault.id) : null}
      check={async (p) => {
        const r = await unlock(vault.id, p);
        if (r.token) return true;
        if (r.error === 'wait') return `יותר מדי ניסיונות. נסה שוב בעוד ${r.minutes} דקות`;
        if (r.error === 'bad') return r.left > 0 ? `קוד שגוי (נשארו ${r.left} ניסיונות)` : 'קוד שגוי';
        return 'אין חיבור לאינטרנט';
      }}
      onOk={onOpen}
      onForgot={() => setMode('recover')}
    />
  );
}

// לוח מקשים. check מחזיר true, או הודעת שגיאה.
export function PinPad({ title, sub, check, onOk, onForgot, bio, onCancel }) {
  const [pin, setPinV] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function tryBio() {
    try { if (await bio()) onOk(); } catch {}
  }
  useEffect(() => { if (bio) tryBio(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function press(d) {
    if (pin.length >= 4 || busy) return;
    const p = pin + d;
    setPinV(p); setMsg('');
    if (p.length === 4) {
      setBusy(true);
      const r = await check(p);
      setBusy(false);
      if (r === true) { setPinV(''); onOk(p); }
      else { setMsg(r || 'קוד שגוי'); setTimeout(() => setPinV(''), 400); if (navigator.vibrate) navigator.vibrate(150); }
    }
  }

  return (
    <div className="lock">
      {onCancel && <button className="btn" style={{ position: 'absolute', top: 16, insetInlineStart: 16 }} onClick={onCancel}>ביטול</button>}
      <h2 style={{ margin: '8px 0 4px' }}>{title}</h2>
      <div className="muted" style={{ minHeight: 22 }}>{msg ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>{msg}</span> : sub}</div>
      <div className={'dots' + (msg ? ' shake' : '')}>{[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        {bio ? <button onClick={tryBio} aria-label="טביעת אצבע / Face ID" style={{ fontSize: 26 }}>👆</button> : <span />}
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => setPinV(pin.slice(0, -1))} aria-label="מחק" style={{ fontSize: 22 }}>⌫</button>
      </div>
      {busy && <div className="spin" style={{ width: 26, height: 26, borderWidth: 3, marginTop: 16 }} />}
      {onForgot && !busy && <button className="muted" style={{ marginTop: 18, textDecoration: 'underline' }} onClick={onForgot}>שכחתי את הקוד</button>}
    </div>
  );
}

function Recover({ vault, onBack, onOk }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr('');
    const r = await unlock(vault.id, code.trim());
    setBusy(false);
    if (r.token) return onOk();
    setErr(r.error === 'wait' ? `יותר מדי ניסיונות. נסה שוב בעוד ${r.minutes} דקות` : 'קוד השחזור לא נכון');
  }
  return (
    <div className="lock">
      <div style={{ fontSize: 46 }}>🔑</div>
      <h2 style={{ margin: '8px 0 4px' }}>שכחתי את הקוד</h2>
      <div className="muted" style={{ maxWidth: 320 }}>הקלד את <b>קוד השחזור</b> (8 תווים, כמו AB12-CD34) שקיבלת כשהפעלת את הנעילה</div>
      <input className="input" dir="ltr" style={{ maxWidth: 260, textAlign: 'center', fontSize: 22, letterSpacing: 3, margin: '18px 0 10px' }}
        value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" maxLength={9} autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
      {err && <div className="err">{err}</div>}
      <button className="btn primary" style={{ minWidth: 200, marginTop: 10 }} onClick={go} disabled={busy || code.replace('-', '').length < 8}>{busy ? 'בודק…' : 'המשך'}</button>
      <button className="muted" style={{ marginTop: 16, textDecoration: 'underline' }} onClick={onBack}>חזרה</button>
    </div>
  );
}

// בחירת קוד חדש (פעמיים) ← שמירה בשרת ← הצגת קוד שחזור
export function NewPin({ vault, onDone, onCancel }) {
  const [first, setFirst] = useState(null);
  const [rec, setRec] = useState(null);
  if (rec) return <RecoveryCode code={rec} name={vault.name} onDone={onDone} />;
  return (
    <PinPad key={first ? 'b' : 'a'}
      title={first ? 'שוב, לאישור' : 'בחר קוד של 4 ספרות'}
      sub={first ? 'הקלד שוב את אותו קוד' : 'הקוד יידרש בכל מכשיר שנכנס לארכיון'}
      onCancel={onCancel}
      check={async (p) => {
        if (!first) return true;
        if (p !== first) return 'הקודים לא תואמים';
        try { setRec(await setPin(vault.id, p)); return true; } catch { return 'לא נשמר. בדוק אינטרנט'; }
      }}
      onOk={(p) => { if (!first) setFirst(p); }}
    />
  );
}

function RecoveryCode({ code, name, onDone }) {
  const text = `קוד שחזור לארכיון הקבלות "${name}": ${code}\n(למקרה ששוכחים את הקוד של 4 הספרות)`;
  return (
    <div className="lock">
      <div style={{ fontSize: 46 }}>🔑</div>
      <h2 style={{ margin: '8px 0 4px' }}>הנעילה הופעלה</h2>
      <div className="muted" style={{ maxWidth: 330 }}>שמור את <b>קוד השחזור</b>. אם שוכחים את הקוד — רק איתו אפשר להיכנס. הוא מוצג רק עכשיו.</div>
      <div dir="ltr" style={{ fontSize: 34, fontWeight: 800, letterSpacing: 4, margin: '20px 0', padding: '12px 22px', borderRadius: 14, background: 'var(--brand-soft)', color: 'var(--brand)' }}>{code}</div>
      <div className="grid2" style={{ width: '100%', maxWidth: 340 }}>
        <a className="btn" href={'https://wa.me/?text=' + encodeURIComponent(text)} target="_blank" rel="noreferrer">💬 שלח לעצמי</a>
        <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(code); } catch {} }}>📋 העתק</button>
      </div>
      <button className="btn primary" style={{ minWidth: 240, marginTop: 14 }} onClick={onDone}>שמרתי, המשך</button>
    </div>
  );
}
