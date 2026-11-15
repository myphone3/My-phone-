'use client';
import { useEffect } from 'react';
import { fmtClock, fmtMinutes, totalMinutes } from '@/lib/recipe';
import { remaining, pauseTimer, resumeTimer, plusTimer, removeTimer } from '@/lib/timers';

export const EMOJI = { 'ארוחות': '🍲', 'בשר ועוף': '🍗', 'דגים': '🐟', 'חלבי': '🧀', 'פשטידות': '🥧', 'מרקים': '🥣', 'סלטים': '🥗', 'תוספות': '🍚', 'לחמים ומאפים': '🥖', 'עוגות': '🎂', 'עוגיות': '🍪', 'קינוחים': '🍮', 'שבת וחג': '🕯️', 'אחר': '🍽️' };
export const emojiFor = (r) => EMOJI[r?.category] || '🍽️';

export function metaLine(r) {
  return [fmtMinutes(totalMinutes(r)), r?.servings ? `${r.servings} מנות` : ''].filter(Boolean).join(' · ');
}

export function Sheet({ onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

export function Timers({ timers, update, now }) {
  if (!timers?.length) return null;
  return (
    <div className="timers">
      {timers.map((t) => {
        const left = remaining(t, now);
        const done = left <= 0 && t.endsAt;
        return (
          <div key={t.id} className={'timer' + (done ? ' done' : '')}>
            <span>{done ? '🔔' : t.endsAt ? '⏱️' : '⏸️'}</span>
            <span className="tt">{done ? 'נגמר!' : fmtClock(left)}</span>
            <span className="lb">{t.label}</span>
            {!done && <button onClick={() => plusTimer(update, t.id, 60)}>+1</button>}
            {!done && (t.endsAt ? <button onClick={() => pauseTimer(update, t.id)}>עצירה</button> : <button onClick={() => resumeTimer(update, t.id)}>המשך</button>)}
            <button onClick={() => removeTimer(update, t.id)}>{done ? 'סגירה' : '✕'}</button>
          </div>
        );
      })}
    </div>
  );
}
