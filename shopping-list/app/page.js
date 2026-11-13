'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getMyLists, getMyName, rememberList, setMyName, forgetList } from '@/lib/local';

export default function Home() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [name, setName] = useState('');
  const [listName, setListName] = useState('');
  const [join, setJoin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLists(getMyLists());
    setName(getMyName());
  }, []);

  async function create() {
    if (!name.trim()) return setErr('איך קוראים לך? (כדי שכולם יראו מי מצא מה)');
    setBusy(true); setErr('');
    setMyName(name.trim());
    const { data, error } = await supabase.rpc('sl_create_list', { p_name: listName || 'קניות לבית' });
    setBusy(false);
    if (error) return setErr('לא הצלחנו ליצור רשימה. בדוק חיבור לאינטרנט.');
    rememberList(data, listName || 'קניות לבית');
    router.push(`/l/${data}`);
  }

  function openJoin() {
    const m = join.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return setErr('הדבק את הקישור שקיבלת');
    if (name.trim()) setMyName(name.trim());
    router.push(`/l/${m[0]}`);
  }

  return (
    <div className="wrap" style={{ paddingTop: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontSize: 60 }}>🛒</div>
        <h1 className="title" style={{ fontSize: 28, whiteSpace: 'normal' }}>רשימת קניות משותפת</h1>
        <div className="muted">כותבים או מדביקים מהוואטסאפ, מסתובבים בחנות, וכולם רואים בזמן אמת מה נמצא</div>
      </div>

      {lists.length > 0 && (
        <div className="card" style={{ padding: 6, marginBottom: 16 }}>
          <div className="muted small" style={{ padding: '8px 10px 2px' }}>הרשימות שלי</div>
          <div className="menu-list">
            {lists.map((l) => (
              <div key={l.id} className="row" style={{ padding: '0 6px' }}>
                <button className="grow" onClick={() => router.push(`/l/${l.id}`)}>
                  <span className="ic">📝</span>
                  <span className="grow" style={{ fontWeight: 700 }}>{l.name}</span>
                  <span className="muted">›</span>
                </button>
                <button className="muted" style={{ padding: 8, width: 'auto', border: 0 }} title="הסר מהמכשיר"
                  onClick={() => { if (confirm('להסיר את הרשימה מהמכשיר הזה? (היא לא תימחק אצל אחרים)')) { forgetList(l.id); setLists(getMyLists()); } }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <div className="field" style={{ marginTop: 0 }}>
          <label>השם שלך</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: דוד" maxLength={30} />
        </div>
        <div className="field">
          <label>שם הרשימה</label>
          <input className="input" value={listName} onChange={(e) => setListName(e.target.value)} placeholder="קניות לבית / שופרסל / לשבת" maxLength={60} />
        </div>
        <button className="btn primary block" onClick={create} disabled={busy}>{busy ? 'יוצר…' : '+ רשימה חדשה'}</button>
        <div className="muted small" style={{ textAlign: 'center', margin: '16px 0 8px' }}>או הצטרף לרשימה שמישהו שלח לך</div>
        <div className="row">
          <input className="input grow" value={join} onChange={(e) => setJoin(e.target.value)} placeholder="הדבק קישור" dir="ltr" />
          <button className="btn" onClick={openJoin}>הצטרף</button>
        </div>
        {err && <div style={{ color: 'var(--red)', marginTop: 10, fontWeight: 600 }}>{err}</div>}
      </div>
    </div>
  );
}
