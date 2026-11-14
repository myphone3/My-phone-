'use client';
import { useState } from 'react';
import { updateKitchen } from '@/lib/api';
import { Sheet } from './ui';

export default function SettingsSheet({ data, kitchenId, follow, setFollow, changed, say, onClose, onLeave }) {
  const [name, setName] = useState(data?.kitchen?.name || '');
  const link = typeof location !== 'undefined' ? `${location.origin}/?k=${kitchenId}` : '';

  const saveName = async () => {
    try { await updateKitchen(kitchenId, { name }); await changed(); say('נשמר ✓'); } catch { say('לא נשמר'); }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'ספר המתכונים שלנו', text: 'הצטרפו לספר המתכונים המשפחתי:', url: link });
      else { await navigator.clipboard.writeText(link); say('הקישור הועתק'); }
    } catch {}
  };

  return (
    <Sheet onClose={onClose}>
      <h3>⚙️ הגדרות</h3>
      <label className="f">שם ספר המתכונים</label>
      <div className="row">
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" onClick={saveName} disabled={!name.trim() || name === data?.kitchen?.name}>שמירה</button>
      </div>

      <label className="f">הטלוויזיה עוקבת אחרי הטלפון</label>
      <button className="option" onClick={() => setFollow(!follow)}>
        <span className="oi">{follow ? '✅' : '⬜'}</span>
        <span><b>{follow ? 'פועל' : 'כבוי'}</b><small>{follow ? 'כל מתכון שפותחים בטלפון נפתח מיד בטלוויזיה' : 'הטלוויזיה מתעדכנת רק כשלוחצים ״הצגה בטלוויזיה״'}</small></span>
      </button>

      <label className="f">משפחה</label>
      <button className="option" onClick={share}>
        <span className="oi">👨‍👩‍👧</span>
        <span><b>שיתוף ספר המתכונים</b><small>מי שיפתח את הקישור יראה ויוסיף מתכונים, ויוכל לשלוט בטלוויזיה</small></span>
      </button>
      <p className="muted small">שמרו את הקישור הזה גם לעצמכם — בעזרתו אפשר לפתוח את המתכונים בטלפון חדש.</p>

      <button className="btn danger block" style={{ marginTop: 20 }} onClick={() => { if (confirm('לנתק את הטלפון הזה מספר המתכונים? המתכונים לא יימחקו, ואפשר לחזור עם הקישור המשפחתי.')) { onLeave(); onClose(); } }}>
        ניתוק הטלפון מספר המתכונים
      </button>
    </Sheet>
  );
}
