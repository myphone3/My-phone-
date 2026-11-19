'use client';
import { useEffect } from 'react';

// דף מלא (קטגוריה / חברה): כותרת עם חץ חזרה. "חזור" של הטלפון סוגר אותו.
export default function Page({ onBack, title, sub, right, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="page">
      <div className="page-in">
        <div className="page-head">
          <button className="icon-btn line back" onClick={onBack} aria-label="חזרה">→</button>
          <div className="grow" style={{ minWidth: 0 }}>
            {sub && <div className="crumb">{sub}</div>}
            <h1 className="title">{title}</h1>
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}
