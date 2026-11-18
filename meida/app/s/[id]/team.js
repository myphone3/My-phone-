'use client';
import { useEffect, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText } from '@/lib/api';
import { copyText } from '@/lib/kb';

const ROLE = { owner: 'בעלים', admin: 'מנהל', member: 'עובד' };

export default function Team({ ctx }) {
  const [list, setList] = useState(null);
  const [shop, setShop] = useState(ctx.shop);
  const [err, setErr] = useState('');
  const load = () => api.members(ctx.shopId).then(setList).catch((e) => setErr(errText(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const link = typeof location !== 'undefined' && shop.join_code ? `${location.origin}/join/${shop.join_code}` : '';
  const isOwner = shop.role === 'owner';

  async function act(u, a) {
    if (a === 'remove' && !confirm(`להסיר את ${u.name || u.email}? הוא לא יוכל להיכנס יותר.`)) return;
    try { await api.setMember(ctx.shopId, u.user_id, a); await load(); ctx.refresh(); } catch (e) { setErr(errText(e)); }
  }
  async function upd(allow, newCode) {
    if (newCode && !confirm('ליצור קישור חדש? הקישור הישן יפסיק לעבוד (מי שכבר בפנים נשאר).')) return;
    try { const r = await api.updateShop(ctx.shopId, shop.name, allow, newCode); setShop((s) => ({ ...s, ...r })); ctx.refresh(); } catch (e) { setErr(errText(e)); }
  }
  const msg = `היי! זה הקישור להצטרפות למאגר המידע של ${shop.name}:\n${link}\nנכנסים עם חשבון Google ואני מאשר.`;

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>👥 עובדים</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {ctx.isAdmin && (
        <div className="card pad">
          <b>הזמנת עובד</b>
          <div className="muted small" style={{ margin: '4px 0 8px' }}>שלח את הקישור לעובד. הוא נכנס עם Google, ואתה מאשר אותו כאן.</div>
          {shop.allow_join ? (
            <>
              <div className="field"><div className="v grow ltr small" style={{ fontSize: 14 }}>{link}</div></div>
              <div className="row wrap-row">
                <a className="btn primary sm" href={'https://wa.me/?text=' + encodeURIComponent(msg)} target="_blank" rel="noreferrer">שליחה בוואטסאפ</a>
                <button className="btn sm" onClick={() => copyText(link).then(() => ctx.toast('הקישור הועתק'))}>העתקה</button>
                <button className="btn sm" onClick={() => upd(true, true)}>קישור חדש</button>
                <button className="btn sm" onClick={() => upd(false)}>סגירת הצטרפות</button>
              </div>
            </>
          ) : (
            <><div className="notice">ההצטרפות סגורה — אף אחד חדש לא יכול לבקש להצטרף.</div><button className="btn sm" onClick={() => upd(true)}>פתיחת הצטרפות</button></>
          )}
        </div>
      )}
      {err && <div className="err">{err}</div>}
      {list === null ? <div className="spin" style={{ margin: 20 }} /> : (
        <>
          {list.some((u) => u.status === 'pending') && <div className="h2">⏳ מחכים לאישור</div>}
          {list.filter((u) => u.status === 'pending').map((u) => (
            <div key={u.user_id} className="card member">
              <div className="avatar">{u.avatar ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" /> : (u.name || '?')[0]}</div>
              <div className="grow"><b>{u.name}</b><div className="muted small ltr" style={{ textAlign: 'start' }}>{u.email}</div></div>
              {ctx.isAdmin && <><button className="btn sm primary" onClick={() => act(u, 'approve')}>אישור</button><button className="btn sm danger" onClick={() => act(u, 'remove')}>דחייה</button></>}
            </div>
          ))}
          <div className="h2">בחנות ({list.filter((u) => u.status === 'active').length})</div>
          {list.filter((u) => u.status === 'active').map((u) => (
            <div key={u.user_id} className="card member">
              <div className="avatar">{u.avatar ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" /> : (u.name || '?')[0]}</div>
              <div className="grow">
                <b>{u.name}{u.me && ' (אני)'}</b>
                <div className="muted small">{ROLE[u.role]} · הוסיף {u.count} פריטים</div>
              </div>
              {isOwner && !u.me && u.role !== 'owner' && (
                <button className="btn sm" onClick={() => act(u, u.role === 'admin' ? 'member' : 'admin')}>{u.role === 'admin' ? 'הורד מניהול' : 'הפוך למנהל'}</button>
              )}
              {ctx.isAdmin && !u.me && u.role !== 'owner' && <button className="btn sm danger" onClick={() => act(u, 'remove')}>הסרה</button>}
            </div>
          ))}
          <div className="muted small" style={{ marginTop: 10 }}>עובד יכול להוסיף ולערוך הכל (כל שינוי נשמר בהיסטוריה). מחיקה, אישור עובדים וניהול תגיות — רק מנהל.</div>
        </>
      )}
    </Sheet>
  );
}
