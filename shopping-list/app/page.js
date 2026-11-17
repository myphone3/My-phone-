'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import InstallButton from '@/components/InstallButton';
import { getMyLists, getMyName, rememberList, setMyName, forgetList } from '@/lib/local';
import { Sheet } from './l/[id]/sheets';

// מסך הבית: שם האפליקציה, הרשימות שלי, רשימה חדשה, הצטרפות לרשימה, הגדרות.
// לא שואלים שם בכניסה — השם נמצא בהגדרות (⚙️) ואפשר לשנות אותו מתי שרוצים.
export default function Home() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState(null); // 'new' | 'join' | 'settings'
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const l = getMyLists();
    setLists(l);
    setName(getMyName());
    setReady(true);
    // מכינים מראש את מסך הרשימה, כדי שהכניסה אליה תהיה מיידית
    for (const x of l.slice(0, 5)) router.prefetch(`/l/${x.id}`);
    if (/[?&]all/.test(location.search)) history.replaceState(null, '', '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wrap" style={{ paddingTop: 14 }}>
      <div className="row" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 34 }}>🛒</div>
        <div className="grow">
          <h1 className="title" style={{ fontSize: 24 }}>רשימת קניות</h1>
          <div className="muted small">{name ? `שלום ${name} 👋` : 'רשימה משותפת שמתעדכנת אצל כולם'}</div>
        </div>
        <button className="icon-btn" onClick={() => setSheet('settings')} aria-label="הגדרות">⚙️</button>
      </div>

      <div className="row" style={{ gap: 10, marginBottom: 16 }}>
        <button className="btn primary grow big-action" onClick={() => setSheet('new')}>
          <span style={{ fontSize: 24 }}>➕</span>רשימה חדשה
        </button>
        <button className="btn grow big-action" onClick={() => setSheet('join')}>
          <span style={{ fontSize: 24 }}>🔗</span>הצטרפות לרשימה
        </button>
      </div>

      {ready && lists.length > 0 && (
        <div className="card" style={{ padding: 6, marginBottom: 16 }}>
          <div className="muted small" style={{ padding: '8px 10px 2px', fontWeight: 700 }}>הרשימות שלי</div>
          <div className="menu-list">
            {lists.map((l) => (
              <div key={l.id} className="row" style={{ padding: '0 6px' }}>
                <button className="grow" onClick={() => router.push(`/l/${l.id}`)}>
                  <span className="ic">📝</span>
                  <span className="grow" style={{ fontWeight: 700 }}>{l.name}</span>
                  <span className="muted">‹</span>
                </button>
                <button className="muted" style={{ padding: 8, width: 'auto', border: 0 }} aria-label="הסר מהמכשיר"
                  onClick={() => { if (confirm(`להסיר את "${l.name}" מהמכשיר הזה?\n(הרשימה לא נמחקת אצל אחרים)`)) { forgetList(l.id); setLists(getMyLists()); } }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ready && lists.length === 0 && (
        <div className="card" style={{ padding: 18, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 44 }}>📝</div>
          <div style={{ fontWeight: 800, fontSize: 17, margin: '6px 0 4px' }}>עוד אין לך רשימות</div>
          <div className="muted small">
            לוחצים <b>רשימה חדשה</b>, ומשם אפשר לשתף אותה עם המשפחה בוואטסאפ.
            <br />קיבלת קישור מחבר? פשוט לוחצים עליו — או <b>הצטרפות לרשימה</b>.
          </div>
        </div>
      )}

      <InstallButton />

      {sheet === 'new' && (
        <NewListSheet onClose={() => setSheet(null)} onCreated={(id) => router.push(`/l/${id}`)} />
      )}
      {sheet === 'join' && (
        <JoinSheet onClose={() => setSheet(null)} onJoin={(id) => router.push(`/l/${id}`)} />
      )}
      {sheet === 'settings' && (
        <SettingsSheet name={name} onClose={() => setSheet(null)}
          onSave={(n) => { setMyName(n); setName(n); setSheet(null); }} />
      )}
    </div>
  );
}

function NewListSheet({ onClose, onCreated }) {
  const [listName, setListName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const SUGGEST = ['קניות לבית', 'לשבת', 'סופר', 'פארם'];

  async function create() {
    const n = listName.trim() || 'קניות לבית';
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('sl_create_list', { p_name: n });
    if (error) { setBusy(false); return setErr('לא הצלחנו ליצור רשימה. בדוק חיבור לאינטרנט.'); }
    rememberList(data, n);
    onCreated(data);
  }

  return (
    <Sheet onClose={onClose}>
      <h3>➕ רשימה חדשה</h3>
      <div className="field" style={{ marginTop: 0 }}>
        <label>איך לקרוא לרשימה? (לא חובה)</label>
        <input className="input" value={listName} onChange={(e) => setListName(e.target.value)} autoFocus maxLength={60}
          placeholder="קניות לבית" onKeyDown={(e) => { if (e.key === 'Enter') create(); }} />
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {SUGGEST.map((s) => (
          <button key={s} className={'chip' + (listName === s ? ' on' : '')} onClick={() => setListName(s)}>{s}</button>
        ))}
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={create} disabled={busy}>{busy ? 'יוצר…' : 'צור רשימה'}</button>
      <div className="muted small" style={{ textAlign: 'center', marginTop: 10 }}>את השם אפשר לשנות אחר כך, ולשתף עם חברים מתוך הרשימה</div>
      {err && <div style={{ color: 'var(--red)', marginTop: 10, fontWeight: 600 }}>{err}</div>}
    </Sheet>
  );
}

function JoinSheet({ onClose, onJoin }) {
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');

  async function pasteFromClipboard() {
    try { const t = await navigator.clipboard.readText(); if (t) { setLink(t); go(t); } } catch { setErr('הדבק את הקישור בתיבה'); }
  }
  function go(t = link) {
    const m = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return setErr('זה לא נראה כמו קישור לרשימה. העתק את כל הקישור שקיבלת.');
    onJoin(m[0]);
  }

  return (
    <Sheet onClose={onClose}>
      <h3>🔗 הצטרפות לרשימה של מישהו</h3>
      <div className="muted small" style={{ marginBottom: 12 }}>
        הכי פשוט: לוחצים על הקישור שקיבלתם בוואטסאפ והרשימה נפתחת. אם זה לא עבד — העתיקו את הקישור והדביקו כאן.
      </div>
      <div className="row">
        <input className="input grow" value={link} onChange={(e) => { setLink(e.target.value); setErr(''); }} placeholder="הדבק קישור" dir="ltr"
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
        <button className="btn primary" onClick={() => go()}>הצטרף</button>
      </div>
      <button className="btn block" style={{ marginTop: 10 }} onClick={pasteFromClipboard}>📋 הדבק מהלוח</button>
      {err && <div style={{ color: 'var(--red)', marginTop: 10, fontWeight: 600 }}>{err}</div>}
    </Sheet>
  );
}

function SettingsSheet({ name, onClose, onSave }) {
  const [n, setN] = useState(name || '');
  return (
    <Sheet onClose={onClose}>
      <h3>⚙️ הגדרות</h3>
      <div className="field" style={{ marginTop: 0 }}>
        <label>השם שלי</label>
        <input className="input" value={n} onChange={(e) => setN(e.target.value)} maxLength={30} placeholder="למשל: דוד"
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(n.trim()); }} />
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        נרשם פעם אחת בטלפון הזה. כך החברים ברשימה יראו מי הוסיף, מי מצא ומי מביא מה. לא חובה.
      </div>
      <button className="btn primary block" style={{ marginTop: 14 }} onClick={() => onSave(n.trim())}>שמור</button>
    </Sheet>
  );
}
