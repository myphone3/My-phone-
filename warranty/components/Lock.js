'use client';
import { useEffect, useState } from 'react';
import { lockOn, lockInfo, checkPin, checkBio, markUnlocked, isUnlocked, relock } from '@/lib/lock';

// מסך נעילה מעל האפליקציה (רק אם הנעילה הופעלה בהגדרות בטלפון הזה)
export default function Lock({ children, onForgot }) {
  const [locked, setLocked] = useState(null);

  useEffect(() => {
    setLocked(lockOn() && !isUnlocked());
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (lockOn() && hiddenAt && Date.now() - hiddenAt > 60000) { relock(); setLocked(true); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (locked === null) return null;
  if (!locked) return children;
  return <PinPad onOk={() => { markUnlocked(); setLocked(false); }} onForgot={onForgot} />;
}

export function PinPad({ title = 'הקבלות נעולות', sub = 'הקלד את הקוד', onOk, onForgot, check = checkPin, bio = true }) {
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);
  const hasBio = bio && !!lockInfo()?.cred;

  async function tryBio() {
    try { if (await checkBio()) onOk(); } catch {}
  }
  useEffect(() => { if (hasBio) tryBio(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function press(d) {
    if (pin.length >= 4) return;
    const p = pin + d;
    setPin(p); setBad(false);
    if (p.length === 4) {
      if (await check(p)) { setTimeout(() => setPin(''), 150); onOk(p); }
      else { setBad(true); setTimeout(() => setPin(''), 400); if (navigator.vibrate) navigator.vibrate(150); }
    }
  }

  return (
    <div className="lock">
      <div style={{ fontSize: 46 }}>🔒</div>
      <h2 style={{ margin: '8px 0 4px' }}>{title}</h2>
      <div className="muted">{bad ? <span style={{ color: 'var(--red)', fontWeight: 700 }}>קוד שגוי, נסה שוב</span> : sub}</div>
      <div className={'dots' + (bad ? ' shake' : '')}>{[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        {hasBio ? <button onClick={tryBio} aria-label="טביעת אצבע" style={{ fontSize: 26 }}>👆</button> : <span />}
        <button onClick={() => press('0')}>0</button>
        <button onClick={() => setPin(pin.slice(0, -1))} aria-label="מחק" style={{ fontSize: 22 }}>⌫</button>
      </div>
      {onForgot && <button className="muted" style={{ marginTop: 18, textDecoration: 'underline' }} onClick={onForgot}>שכחתי את הקוד</button>}
    </div>
  );
}
