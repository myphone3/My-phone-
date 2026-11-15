'use client';
import { useEffect } from 'react';
import { fmtClock, fmtMinutes, totalMinutes } from '@/lib/recipe';
import { remaining, pauseTimer, resumeTimer, plusTimer, removeTimer } from '@/lib/timers';

export const EMOJI = { 'ארוחות': '🍲', 'בשר ועוף': '🍗', 'דגים': '🐟', 'חלבי': '🧀', 'פשטידות': '🥧', 'מרקים': '🥣', 'סלטים': '🥗', 'תוספות': '🍚', 'לחמים ומאפים': '🥖', 'עוגות': '🎂', 'עוגיות': '🍪', 'קינוחים': '🍮', 'שבת וחג': '🕯️', 'אחר': '🍽️' };
export const emojiFor = (r) => EMOJI[r?.category] || '🍽️';

export function metaLine(r) {
  return [fmtMinutes(totalMinutes(r)), r?.servings ? `${r.servings} מנות` : ''].filter(Boolean).join(' · ');
}

// אנימציית המתנה: האייקון של האפליקציה — המכסה של המגש מתרומם, יוצא אדים, ונסגר שוב
export function Loader({ size = 84 }) {
  return (
    <svg className="loader" width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="טוען">
      <rect width="512" height="512" rx="112" fill="#d9622b" />
      <rect x="96" y="128" width="320" height="216" rx="28" fill="#fff6ec" />
      <rect x="216" y="356" width="80" height="26" rx="8" fill="#fff6ec" />
      <rect x="168" y="378" width="176" height="22" rx="11" fill="#fff6ec" />
      <g className="ld-lid">
        <path d="M196 250c0-44 26-74 60-74s60 30 60 74z" fill="#d9622b" />
        <circle cx="256" cy="170" r="10" fill="#d9622b" />
      </g>
      <g className="ld-steam" fill="none" stroke="#e8946a" strokeWidth="11" strokeLinecap="round">
        <path className="s1" d="M282 242c-10-12 10-22 0-34" />
        <path className="s2" d="M308 238c-10-12 10-22 0-34" />
        <path className="s3" d="M334 242c-10-12 10-22 0-34" />
      </g>
      <rect x="176" y="250" width="160" height="22" rx="11" fill="#d9622b" />
    </svg>
  );
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
