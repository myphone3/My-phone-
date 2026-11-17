'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// לכאן חוזרים אחרי כניסה עם Google. פרטי הכניסה נקלטים מהכתובת, ואז ממשיכים לאן שהיינו.
export default function AuthReturn() {
  const router = useRouter();
  const [err, setErr] = useState('');
  useEffect(() => {
    const next = new URLSearchParams(location.search).get('next') || '/';
    const safe = /^\/[^/]/.test(next) || next === '/' ? next : '/';
    const hashErr = new URLSearchParams(location.hash.slice(1)).get('error_description');
    if (hashErr) { setErr(hashErr); return; }
    let done = false;
    const go = () => { if (!done) { done = true; router.replace(safe); } };
    supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) go(); });
    const t = setTimeout(() => { if (!done) setErr('הכניסה לא הושלמה'); }, 8000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, [router]);
  return (
    <div className="reading" style={{ paddingTop: 120 }}>
      {err ? (<><div style={{ fontSize: 44 }}>😕</div><b>{err}</b><a className="btn" href="/">חזרה</a></>) : (<><div className="spin" /><div className="muted">מתחבר…</div></>)}
    </div>
  );
}
