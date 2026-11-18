'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, signInWithGoogle, userName, GoogleButton } from '@/lib/auth';
import { api, errText } from '@/lib/api';
import { setLastShop } from '@/lib/cache';

// קישור הצטרפות לחנות. העובד נכנס עם Google, ומחכה שמנהל יאשר אותו.
export default function Join({ params }) {
  const code = params.code;
  const user = useUser();
  const router = useRouter();
  const [info, setInfo] = useState(undefined);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    api.joinInfo(code).then((i) => { setInfo(i); if (i?.my_status) setStatus(i.my_status); }).catch((e) => { setErr(errText(e)); setInfo(null); });
  }, [user, code]);

  useEffect(() => {
    if (status === 'active' && info?.id) { setLastShop(info.id); router.replace('/s/' + info.id); }
  }, [status, info, router]);

  // בדיקה כל כמה שניות אם המנהל כבר אישר
  useEffect(() => {
    if (status !== 'pending') return;
    const t = setInterval(() => api.joinInfo(code).then((i) => i?.my_status && setStatus(i.my_status)).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [status, code]);

  async function join() {
    setBusy(true); setErr('');
    try {
      const r = await api.join(code);
      if (r.error) setErr(r.error === 'closed' ? 'ההצטרפות לחנות סגורה כרגע — בקש מהמנהל לפתוח' : r.error === 'removed' ? 'הוסרת מהחנות. דבר עם המנהל' : 'הקישור לא תקין');
      else setStatus(r.status);
    } catch (e) { setErr(errText(e)); }
    setBusy(false);
  }

  return (
    <div className="wrap">
      <div className="hero">
        {info?.logo_url ? <img className="shop-logo lg" src={info.logo_url} alt="" /> : <div className="logo">🗂️</div>}
        <h1>{info?.name || 'מידע לחנות'}</h1>
        {info?.owner_name && <div className="muted">הזמנה מ{info.owner_name}</div>}
      </div>
      {user === undefined ? <div className="spin" /> : !user ? (
        <>
          <div className="muted center" style={{ marginBottom: 14 }}>כדי להצטרף לחנות צריך להיכנס עם חשבון Google</div>
          <GoogleButton busy={busy} onClick={() => { setBusy(true); signInWithGoogle('/join/' + code); }} />
        </>
      ) : info === undefined ? <div className="spin" /> : info === null ? (
        <div className="notice bad-box center">הקישור לא תקין או שהוחלף. בקש מהמנהל קישור חדש.</div>
      ) : status === 'pending' ? (
        <div className="card pad center">
          <div style={{ fontSize: 40 }}>⏳</div>
          <b>הבקשה נשלחה!</b>
          <div className="muted" style={{ marginTop: 6 }}>מנהל החנות צריך לאשר אותך. ברגע שיאשר — האפליקציה תיפתח לבד.</div>
          <div className="muted small" style={{ marginTop: 10 }}>מחובר בתור {userName(user)} ({user.email})</div>
        </div>
      ) : (
        <>
          <div className="muted center" style={{ marginBottom: 14 }}>מחובר בתור {userName(user)}</div>
          <button className="btn primary block" disabled={busy} onClick={join}>{busy ? 'שולח…' : 'בקשה להצטרף לחנות'}</button>
        </>
      )}
      {err && <div className="err center">{err}</div>}
    </div>
  );
}
