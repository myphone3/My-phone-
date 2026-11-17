'use client';
import { useState } from 'react';
import { read, write } from '@/lib/local';
import { updateKitchen } from '@/lib/api';
import { Sheet } from './ui';
import { shareText } from '@/lib/recipe';

export default function SettingsSheet({ data, kitchenId, follow, setFollow, changed, say, onClose, onLeave, cast }) {
  const [mode, setMode] = useState(() => read('rc_tvmode', 'board'));
  const pickMode = (m) => { setMode(m); write('rc_tvmode', m); };
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

  const appUrl = typeof location !== 'undefined' ? location.origin + '/' : '';
  const shareApp = () => shareText(`מתכונים בגדול 🍳📺 — כל המתכונים מסודרים לפי שלבים ומוצגים בגדול על הטלוויזיה.\nפותחים ספר מתכונים משלכם כאן:\n${appUrl}`, 'מתכונים בגדול');
  const copyApp = async () => { try { await navigator.clipboard.writeText(appUrl); say('הקישור לאפליקציה הועתק'); } catch { prompt('העתיקו את הקישור:', appUrl); } };

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

      <label className="f">מה רואים בטלוויזיה כשפותחים מתכון</label>
      <div className="seg">
        <button className={mode === 'board' ? 'on' : ''} onClick={() => pickMode('board')}>📋 הכל על המסך</button>
        <button className={mode === 'recipe' ? 'on' : ''} onClick={() => pickMode('recipe')}>🖼️ עם תמונה</button>
        <button className={mode === 'cook' ? 'on' : ''} onClick={() => pickMode('cook')}>👣 שלב שלב</button>
      </div>
      <p className="muted small" style={{ margin: '6px 2px 0' }}>{mode === 'board' ? 'כל המצרכים וכל השלבים על מסך אחד, גדול וברור — בלי תזוזה ובלי גלילה.' : mode === 'recipe' ? 'תמונה, מצרכים ושלבים — אפשר לגלול בשלט.' : 'שלב אחד גדול בכל פעם, מעבירים מהטלפון או מהשלט.'}</p>

      <label className="f">שומר מסך בטלוויזיה</label>
      <button className="option" onClick={() => cast.update({ saver: !cast.state.saver })}>
        <span className="oi">{cast.state.saver ? '✅' : '⬜'}</span>
        <span><b>{cast.state.saver ? 'פועל' : 'כבוי — המסך תמיד נשאר על המתכון/התפריט'}</b><small>כשפועל: אחרי 4 דקות בלי שימוש במסך הבית יוצגו תמונות המתכונים ושעון</small></span>
      </button>

      <label className="f">משפחה</label>
      <button className="option" onClick={share}>
        <span className="oi">👨‍👩‍👧</span>
        <span><b>שיתוף ספר המתכונים שלנו עם המשפחה</b><small>מי שיפתח את הקישור יראה ויוסיף מתכונים, ויוכל לשלוט בטלוויזיה</small></span>
      </button>
      <p className="muted small">⚠️ מי שמקבל את הקישור הזה רואה ועורך <b>את המתכונים שלכם</b> — רק למשפחה. שמרו אותו גם לעצמכם — בעזרתו אפשר לפתוח את המתכונים בטלפון חדש.</p>

      <label className="f">חבר רוצה גם?</label>
      <button className="option" onClick={shareApp}>
        <span className="oi">📲</span>
        <span><b>שיתוף האפליקציה (בלי המתכונים שלי)</b><small>הוא מקבל אפליקציה ריקה ופותח ספר מתכונים משלו. הוא לא רואה את שלכם.</small></span>
      </button>
      <button className="btn block" onClick={copyApp}>🔗 העתקת קישור לאפליקציה</button>

      <button className="btn danger block" style={{ marginTop: 20 }} onClick={() => { if (confirm('לנתק את הטלפון הזה מספר המתכונים? המתכונים לא יימחקו, ואפשר לחזור עם הקישור המשפחתי.')) { onLeave(); onClose(); } }}>
        ניתוק הטלפון מספר המתכונים
      </button>
    </Sheet>
  );
}
