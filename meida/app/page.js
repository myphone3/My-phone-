'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, signInWithGoogle, signOut, userName, GoogleButton } from '@/lib/auth';
import { api, errText } from '@/lib/api';
import { setLastShop } from '@/lib/cache';

export default function Home() {
  const user = useUser();
  const router = useRouter();
  const [shops, setShops] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const all = typeof location !== 'undefined' && /[?&]all/.test(location.search);

  useEffect(() => {
    if (!user) return;
    api.myShops().then((l) => {
      setShops(l);
      const active = l.filter((s) => s.status === 'active');
      if (active.length === 1 && l.length === 1 && !all) { setLastShop(active[0].id); router.replace('/s/' + active[0].id); }
    }).catch((e) => { setErr(errText(e)); setShops([]); });
  }, [user]); // eslint-disable-line

  async function create() {
    setBusy(true); setErr('');
    try { const id = await api.createShop(name || 'החנות שלי'); setLastShop(id); router.replace('/s/' + id); }
    catch (e) { setErr(errText(e)); setBusy(false); }
  }

  if (user === undefined) return <div className="reading"><div className="spin" /></div>;

  if (!user) return (
    <div className="wrap">
      <div className="hero">
        <div className="logo">🗂️</div>
        <h1>מידע לחנות</h1>
        <div className="muted">כל מה שצריך לדעת בחנות — במקום אחד, מסודר ומשותף לכל העובדים</div>
      </div>
      <div className="feat">
        {[['🔎', 'חיפוש מהיר בכל המידע — גם לפי IMEI, טלפון או קוד'], ['🏢', 'מסודר לפי חברות, מכשירים ונושאים — פריט אחד יכול להיות בכמה'],
          ['📍', 'נקודות שירות עם ניווט בוויז וחיוג בלחיצה'], ['💬', 'ייבוא אוטומטי של כל מה שרשמת בוואטסאפ'], ['👥', 'משותף לכל העובדים, כל אחד עם החשבון שלו']]
          .map(([e, t]) => <div className="card" key={t}><span style={{ fontSize: 24 }}>{e}</span><span>{t}</span></div>)}
      </div>
      <GoogleButton busy={busy} onClick={() => { setBusy(true); signInWithGoogle('/'); }} />
    </div>
  );

  return (
    <div className="wrap">
      <div className="top row">
        <h1 className="title grow">שלום {userName(user)}</h1>
        <button className="btn sm" onClick={() => signOut().then(() => { setLastShop(''); location.replace('/'); })}>יציאה</button>
      </div>
      {shops === null ? <div className="reading"><div className="spin" /></div> : (
        <>
          {shops.length > 0 && <div className="h2">החנויות שלי</div>}
          {shops.map((s) => (
            <button key={s.id} className="card it" onClick={() => { if (s.status === 'active') { setLastShop(s.id); router.push('/s/' + s.id); } }}>
              <div className="ic">🏪</div>
              <div className="grow">
                <div className="t">{s.name}</div>
                <div className="s">{s.status === 'pending' ? '⏳ מחכה לאישור של מנהל החנות' : s.role === 'owner' ? 'בעלים' : s.role === 'admin' ? 'מנהל' : 'עובד'}</div>
              </div>
            </button>
          ))}
          <div className="card pad" style={{ marginTop: 16 }}>
            <b>פתיחת חנות חדשה</b>
            <div className="muted small" style={{ margin: '4px 0 10px' }}>
              אם אתה עובד בחנות שכבר קיימת — בקש מהמנהל את קישור ההצטרפות. אם אתה המנהל — פתח כאן את החנות והזמן את העובדים.
            </div>
            <input className="input" placeholder="שם החנות" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary block" style={{ marginTop: 10 }} disabled={busy} onClick={create}>{busy ? 'פותח…' : 'פתיחת החנות'}</button>
          </div>
          {err && <div className="err">{err}</div>}
        </>
      )}
    </div>
  );
}
