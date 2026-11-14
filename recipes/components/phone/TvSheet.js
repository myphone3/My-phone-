'use client';
import { useState } from 'react';
import { pairTv } from '@/lib/cast';
import { Sheet } from './ui';

export default function TvSheet({ cast, kitchenId, say, onClose }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const host = typeof location !== 'undefined' ? location.host : '';

  const connect = async () => {
    setBusy(true);
    const ok = await pairTv(code, kitchenId);
    setBusy(false);
    if (ok) { say('📺 הטלוויזיה מחוברת!'); onClose(); } else say('לא הצלחנו. בדקו את הקוד שעל מסך הטלוויזיה');
  };

  return (
    <Sheet onClose={onClose}>
      <h3>📺 חיבור לטלוויזיה</h3>
      {cast.tvOnline && <div className="tip">✓ הטלוויזיה מחוברת עכשיו. כל מה שתפתחו כאן יופיע עליה.</div>}
      <ol style={{ paddingInlineStart: 22, lineHeight: 1.7, margin: '6px 0 14px' }}>
        <li>בטלוויזיה פותחים את <b>הדפדפן</b> (Internet / Browser)</li>
        <li>כותבים בשורת הכתובת: <b dir="ltr" style={{ background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 8 }}>{host}</b></li>
        <li>על המסך יופיע קוד של 6 ספרות — מקלידים אותו כאן, או סורקים את הברקוד שעל המסך עם המצלמה</li>
      </ol>
      <input className="code-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
      <button className="btn primary big block" style={{ marginTop: 12 }} disabled={code.length !== 6 || busy} onClick={connect}>{busy ? 'מתחברים...' : 'חיבור'}</button>
      <p className="muted small" style={{ marginTop: 12 }}>מספיק לחבר פעם אחת — בפעם הבאה שתפתחו את הכתובת בטלוויזיה היא תתחבר לבד. כדאי לשמור אותה במועדפים של הדפדפן בטלוויזיה.</p>
    </Sheet>
  );
}
