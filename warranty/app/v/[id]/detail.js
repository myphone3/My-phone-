'use client';
import { useState } from 'react';
import { status, fmtDate, fmtPrice, monthsLabel, catEmoji } from '@/lib/warranty';
import Sheet from '@/components/Sheet';

const ICON = { active: '🛡️', soon: '⏰', expired: '⌛', none: '🧾', unknown: '❔' };

export default function Detail({ r, onClose, onEdit, onDelete, say }) {
  const [view, setView] = useState(-1);
  const s = status(r);
  const total = r.warranty_months ? Math.max(1, s.end ? (s.end - new Date(r.purchase_date)) / 86400000 : 1) : 1;
  const pct = s.days !== undefined ? Math.max(0, Math.min(100, (s.days / total) * 100)) : 0;

  async function share() {
    const lines = [
      `🧾 ${r.product || 'קבלה'}`,
      r.store && `חנות: ${r.store}`,
      r.purchase_date && `תאריך קנייה: ${fmtDate(r.purchase_date)}`,
      r.price !== null && r.price !== undefined && `מחיר: ${fmtPrice(r.price)}`,
      s.end && `אחריות עד: ${fmtDate(s.end)}`,
      r.serial && `מספר סידורי: ${r.serial}`,
    ].filter(Boolean);
    try {
      if (r.photos?.[0] && navigator.canShare) {
        const blob = await (await fetch(r.photos[0])).blob();
        const file = new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text: lines.join('\n') });
      }
      if (navigator.share) return await navigator.share({ text: lines.concat(r.photos || []).join('\n') });
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(lines.concat(r.photos || []).join('\n')); say('📋 הפרטים הועתקו'); } catch {}
  }

  return (
    <>
      <Sheet onClose={onClose}>
        <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
          <div className="grow">
            <h3 style={{ margin: 0 }}>{r.product || r.store || 'קבלה'}</h3>
            {r.product && r.store && <div className="muted">🏪 {r.store}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        {r.photos?.length > 0 && (
          <>
            <button style={{ width: '100%' }} onClick={() => setView(0)}><img className="hero" src={r.photos[0]} alt="הקבלה" /></button>
            {r.photos.length > 1 && (
              <div className="photos" style={{ marginTop: 8 }}>
                {r.photos.slice(1).map((u, i) => <button className="ph" key={u} onClick={() => setView(i + 1)}><img src={u} alt="" /></button>)}
              </div>
            )}
            <div className="muted small" style={{ textAlign: 'center', marginTop: 4 }}>לחץ על התמונה להגדלה</div>
          </>
        )}

        <div className={'big-status s-' + s.k}>
          <div className="ic">{ICON[s.k]}</div>
          <div className="grow">
            <b>{s.label}</b>
            {s.end && <div className="small">{s.k === 'expired' ? 'הסתיימה ב-' : 'בתוקף עד '}{fmtDate(s.end)}</div>}
            {(s.k === 'active' || s.k === 'soon') && <div className="bar"><div style={{ width: pct + '%' }} /></div>}
          </div>
        </div>

        <dl className="kv">
          {r.purchase_date && <><dt>📅 נקנה</dt><dd>{fmtDate(r.purchase_date)}</dd></>}
          {r.price !== null && r.price !== undefined && <><dt>💰 מחיר</dt><dd>{fmtPrice(r.price)}</dd></>}
          <dt>🛡️ אחריות</dt><dd>{monthsLabel(r.warranty_months)}</dd>
          {r.category && <><dt>{catEmoji(r.category)} קטגוריה</dt><dd>{r.category}</dd></>}
          {r.serial && <><dt>🔢 סידורי</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{r.serial}</dd></>}
          {r.items?.length > 1 && <><dt>📦 בקבלה</dt><dd>{r.items.join(' · ')}</dd></>}
          {r.notes && <><dt>📝 הערות</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</dd></>}
        </dl>

        <div className="grid2">
          <button className="btn primary" onClick={onEdit}>✏️ עריכה</button>
          <button className="btn" onClick={share}>📤 שיתוף</button>
        </div>
        <button className="btn danger block" style={{ marginTop: 10 }} onClick={onDelete}>🗑️ מחיקה</button>
      </Sheet>

      {view >= 0 && (
        <div className="viewer">
          <div className="vimg"><img src={r.photos[view]} alt="" /></div>
          <div className="vbar">
            <button onClick={() => setView(-1)}>✕ סגור</button>
            {r.photos.length > 1 && <span style={{ color: '#fff', alignSelf: 'center' }}>{view + 1} / {r.photos.length}</span>}
            <div className="row">
              {r.photos.length > 1 && <button onClick={() => setView((view + 1) % r.photos.length)}>הבאה ‹</button>}
              <a href={r.photos[view]} target="_blank" rel="noreferrer"><button>⬇️ פתח</button></a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
