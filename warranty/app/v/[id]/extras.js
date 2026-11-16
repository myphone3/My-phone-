'use client';
import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import { PinPad, NewPin } from '@/components/Lock';
import { getSetting, setSetting } from '@/lib/settings';
import { enablePush, disablePush, pushSupport } from '@/lib/push';
import { unlock, clearPin, bioAvailable, addBio, removeBio, hasBio, markOpen } from '@/lib/lock';
import { catEmoji, fmtPrice } from '@/lib/warranty';

function Toggle({ ic, title, sub, on, onClick, busy }) {
  return (
    <button className="toggle" onClick={onClick} disabled={busy}>
      <span className="ic">{ic}</span>
      <span className="grow"><b>{title}</b>{sub && <div className="muted small">{sub}</div>}</span>
      {busy ? <div className="spin" style={{ width: 24, height: 24, borderWidth: 3 }} /> : <span className={'switch' + (on ? ' on' : '')} />}
    </button>
  );
}

// הגדרות. הנעילה בקוד שייכת לארכיון (כל המכשירים), השאר נשמרות בטלפון הזה.
export function SettingsSheet({ vault, onVault, onClose, onChange, say }) {
  const vaultId = vault.id;
  const [s, setS] = useState({ notify: false, stats: false, enhance: false });
  const [bio, setBio] = useState({ can: false, on: false });
  const [busy, setBusy] = useState('');
  const [pinStep, setPinStep] = useState(null); // null | 'new' | 'off' | 'change'

  useEffect(() => {
    setS({ notify: getSetting('notify'), stats: getSetting('stats'), enhance: getSetting('enhance') });
    bioAvailable().then((can) => setBio({ can, on: hasBio(vaultId) }));
  }, [vaultId]);

  const save = (k, v) => { setSetting(k, v); setS((x) => ({ ...x, [k]: v })); onChange?.(); };

  async function toggleNotify() {
    if (s.notify) { setBusy('notify'); await disablePush(); setBusy(''); save('notify', false); return say('🔕 ההתראות כובו'); }
    const sup = pushSupport();
    if (sup === 'ios-install') return alert('באייפון: קודם מוסיפים את האפליקציה למסך הבית (שיתוף ← "הוסף למסך הבית"), פותחים משם, ואז מפעילים כאן.');
    if (sup !== 'ok') return alert('הטלפון או הדפדפן הזה לא תומכים בהתראות. נסה בכרום.');
    setBusy('notify');
    const r = await enablePush(vaultId);
    setBusy('');
    if (r === 'ok') { save('notify', true); say('🔔 ההתראות הופעלו — תגיע עכשיו התראת ניסיון'); }
    else if (r === 'denied') alert('ההתראות חסומות. פתח את הגדרות האתר בדפדפן (🔒 ליד הכתובת) ← התראות ← אפשר, ונסה שוב.');
    else say('לא הצלחנו להפעיל, נסה שוב');
  }

  async function toggleBio() {
    if (bio.on) { removeBio(vaultId); setBio({ ...bio, on: false }); return say('טביעת אצבע / Face ID כובו בטלפון הזה'); }
    try { await addBio(vaultId, vault.name); setBio({ ...bio, on: true }); say('👆 מעכשיו אפשר לפתוח בטביעת אצבע / Face ID'); } catch { say('לא הופעל'); }
  }

  if (pinStep === 'new' || pinStep === 'change') {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 75 }}>
      <NewPin vault={vault} onCancel={() => setPinStep(null)}
        onDone={() => { setPinStep(null); markOpen(vaultId); onVault({ ...vault, has_pin: true }); say('🔒 הארכיון נעול בקוד'); }} />
    </div>;
  }
  if (pinStep === 'off') {
    return <div style={{ position: 'fixed', inset: 0, zIndex: 75 }}>
      <PinPad title="כיבוי הנעילה" sub="הקלד את הקוד הנוכחי" onCancel={() => setPinStep(null)}
        check={async (p) => {
          const r = await unlock(vaultId, p);
          if (!r.token) return r.error === 'wait' ? `יותר מדי ניסיונות. נסה בעוד ${r.minutes} דקות` : 'קוד שגוי';
          try { await clearPin(vaultId); return true; } catch { return 'לא הצלחנו, נסה שוב'; }
        }}
        onOk={() => { setPinStep(null); setBio({ ...bio, on: false }); onVault({ ...vault, has_pin: false }); say('🔓 הנעילה כובתה בכל המכשירים'); }} />
    </div>;
  }

  return (
    <Sheet onClose={onClose}>
      <h3>⚙️ הגדרות</h3>
      <Toggle ic="🔒" title="נעילה בקוד" sub="בכל מכשיר שנכנס לארכיון יידרש קוד של 4 ספרות" on={!!vault.has_pin} onClick={() => setPinStep(vault.has_pin ? 'off' : 'new')} />
      {vault.has_pin && bio.can && <Toggle ic="👆" title="פתיחה בטביעת אצבע / Face ID" sub="בטלפון הזה, לפי הנעילה של הטלפון" on={bio.on} onClick={toggleBio} />}
      {vault.has_pin && <button className="toggle" onClick={() => setPinStep('change')}><span className="ic">🔁</span><span className="grow"><b>החלפת קוד</b><div className="muted small">מכשירים אחרים יצטרכו להקליד את הקוד החדש</div></span></button>}
      <div className="sec">בטלפון הזה</div>
      <Toggle ic="🔔" title="התראה לפני שהאחריות נגמרת" sub="חודש ושבוע לפני הסוף — לבדוק שהכול תקין" on={s.notify} busy={busy === 'notify'} onClick={toggleNotify} />
      <Toggle ic="📊" title="סיכום הוצאות" sub="כמה הוצאת, לפי שנה, קטגוריה וחנות" on={s.stats} onClick={() => save('stats', !s.stats)} />
      <Toggle ic="✨" title="שיפור אוטומטי לתמונות קבלה" sub="חיתוך הרקע וחיזוק טקסט דהוי — לתמונות חדשות" on={s.enhance} onClick={() => save('enhance', !s.enhance)} />
    </Sheet>
  );
}

function Bars({ rows, max }) {
  return rows.map(([k, v, e]) => (
    <div className="hbar" key={k}>
      <span className="lbl">{e ? e + ' ' : ''}{k}</span>
      <span className="trk"><div style={{ width: Math.max(2, (v / max) * 100) + '%' }} /></span>
      <span className="val">{fmtPrice(Math.round(v))}</span>
    </div>
  ));
}

// סיכום הוצאות
export function StatsSheet({ list, onClose }) {
  const years = useMemo(() => [...new Set(list.map((r) => r.purchase_date?.slice(0, 4)).filter(Boolean))].sort().reverse(), [list]);
  const [year, setYear] = useState(() => years[0] || '');
  const rows = list.filter((r) => !year || r.purchase_date?.startsWith(year));
  const val = (r) => (Number(r.price) || 0) + (Number(r.ext_price) || 0);
  const total = rows.reduce((a, r) => a + val(r), 0);
  const ext = rows.reduce((a, r) => a + (Number(r.ext_price) || 0), 0);
  const group = (key) => {
    const m = {};
    rows.forEach((r) => { const k = key(r); if (val(r)) m[k] = (m[k] || 0) + val(r); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const byCat = group((r) => r.category || 'אחר').map(([k, v]) => [k, v, catEmoji(k)]);
  const byStore = group((r) => r.store || 'לא צוין').slice(0, 8);
  const byYear = years.map((y) => [y, list.filter((r) => r.purchase_date?.startsWith(y)).reduce((a, r) => a + val(r), 0)]).filter(([, v]) => v);
  const top = rows.filter((r) => val(r) > 0).sort((a, b) => val(b) - val(a)).slice(0, 5);

  return (
    <Sheet onClose={onClose}>
      <h3>📊 סיכום הוצאות</h3>
      <div className="chips" style={{ paddingTop: 0 }}>
        {years.map((y) => <button key={y} className={'chip' + (year === y ? ' on' : '')} onClick={() => setYear(y)}>{y}</button>)}
        <button className={'chip' + (!year ? ' on' : '')} onClick={() => setYear('')}>הכל</button>
      </div>
      <div className="bigsum" style={{ marginTop: 10 }}>
        <span className="muted small">{year ? `הוצאות ב-${year}` : 'סך כל ההוצאות'}</span>
        <b>{fmtPrice(Math.round(total))}</b>
        <span className="muted small">{rows.length} קבלות{ext ? ` · מזה ${fmtPrice(ext)} על הרחבות אחריות` : ''}</span>
      </div>
      {!total ? <div className="empty" style={{ padding: 20 }}>אין עדיין מחירים בקבלות של התקופה הזו</div> : (
        <>
          <div className="sec">לפי קטגוריה</div>
          <Bars rows={byCat} max={byCat[0]?.[1] || 1} />
          <div className="sec">לפי חנות</div>
          <Bars rows={byStore} max={byStore[0]?.[1] || 1} />
          {!year && byYear.length > 1 && (<><div className="sec">לפי שנה</div><Bars rows={byYear} max={Math.max(...byYear.map((x) => x[1]))} /></>)}
          <div className="sec">הקניות הגדולות</div>
          {top.map((r) => (
            <div key={r.id} className="hbar"><span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{catEmoji(r.category)} {r.product || r.store}</span><span className="val">{fmtPrice(val(r))}</span></div>
          ))}
          <div className="muted small" style={{ marginTop: 14 }}>💡 שימושי גם לביטוח תכולת דירה — אפשר לייצא את הכל לאקסל מהתפריט</div>
        </>
      )}
    </Sheet>
  );
}
