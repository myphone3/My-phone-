'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getVaults, rememberVault, forgetVault } from '@/lib/local';
import InstallButton from '@/components/InstallButton';
import Sheet from '@/components/Sheet';

// מסך פתיחה: אם כבר יש ארכיון במכשיר — נכנסים אליו ישר
export default function Home() {
  const router = useRouter();
  const [vaults, setVaults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [join, setJoin] = useState(false);

  useEffect(() => {
    const v = getVaults();
    const params = new URLSearchParams(location.search);
    if (v.length === 1 && !params.has('all')) return router.replace(`/v/${v[0].id}`);
    setVaults(v);
  }, [router]);

  async function create() {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('wr_create_vault', { p_name: 'הקבלות שלי' });
    if (error) { setBusy(false); return setErr('לא הצלחנו להתחיל. בדוק חיבור לאינטרנט ונסה שוב.'); }
    rememberVault(data, 'הקבלות שלי');
    router.push(`/v/${data}`);
  }

  if (!vaults) return <div className="reading" style={{ paddingTop: 120 }}><div className="spin" /></div>;

  return (
    <div className="wrap" style={{ paddingTop: 30 }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <img src="/icon-192.png" alt="" width="84" height="84" style={{ borderRadius: 22, margin: '0 auto 12px' }} />
        <h1 className="title" style={{ fontSize: 26, whiteSpace: 'normal' }}>קבלות ואחריות</h1>
        <div className="muted" style={{ marginTop: 6 }}>מצלמים את הקבלה פעם אחת — ומוצאים אותה תוך שנייה כשצריך</div>
      </div>

      {vaults.length > 0 && (
        <div className="card" style={{ padding: 6, marginBottom: 16 }}>
          <div className="muted small" style={{ padding: '8px 10px 2px', fontWeight: 700 }}>הארכיונים שלי</div>
          <div className="menu-list">
            {vaults.map((v) => (
              <div key={v.id} className="row" style={{ padding: '0 6px' }}>
                <button className="grow" onClick={() => router.push(`/v/${v.id}`)}>
                  <span className="ic">🗂️</span><span className="grow" style={{ fontWeight: 700 }}>{v.name}</span><span className="muted">‹</span>
                </button>
                <button className="muted" style={{ padding: 8 }} aria-label="הסר מהמכשיר"
                  onClick={() => { if (confirm(`להסיר את "${v.name}" מהמכשיר הזה?\nהקבלות לא נמחקות — אפשר לחזור עם הקישור.`)) { forgetVault(v.id); setVaults(getVaults()); } }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        {[
          ['📸', 'מצלמים קבלה', 'והאפליקציה קוראת לבד: חנות, מוצר, תאריך ומחיר'],
          ['🛡️', 'בוחרים כמה זמן אחריות', 'שנה, חצי שנה, שנתיים… ורואים כמה נשאר'],
          ['🔎', 'מחפשים כשצריך', 'לפי שם מוצר, חנות, שנה או כל מילה'],
          ['👨‍👩‍👧', 'משתפים עם המשפחה', 'כולם מוסיפים ורואים את אותן קבלות'],
        ].map(([e, t, s]) => (
          <div key={t} className="row" style={{ alignItems: 'flex-start', gap: 12, padding: '7px 0' }}>
            <div style={{ fontSize: 26 }}>{e}</div>
            <div><b>{t}</b><div className="muted small">{s}</div></div>
          </div>
        ))}
      </div>

      <button className="btn primary block" style={{ height: 56, fontSize: 18 }} onClick={create} disabled={busy}>
        {busy ? 'רגע…' : vaults.length ? '➕ ארכיון חדש' : 'בואו נתחיל'}
      </button>
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => setJoin(true)}>🔗 קיבלתי קישור מבן משפחה</button>
      {err && <div className="err">{err}</div>}
      <div style={{ marginTop: 16 }}><InstallButton /></div>

      {join && <JoinSheet onClose={() => setJoin(false)} onJoin={(id) => router.push(`/v/${id}`)} />}
    </div>
  );
}

function JoinSheet({ onClose, onJoin }) {
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  function go(t = link) {
    const m = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return setErr('זה לא נראה כמו קישור לארכיון. העתק את כל הקישור שקיבלת.');
    onJoin(m[0]);
  }
  return (
    <Sheet onClose={onClose}>
      <h3>🔗 הצטרפות לארכיון משותף</h3>
      <div className="muted small" style={{ marginBottom: 12 }}>הכי פשוט: ללחוץ על הקישור שקיבלתם. אם לא עבד — הדביקו אותו כאן.</div>
      <div className="row">
        <input className="input grow" dir="ltr" value={link} placeholder="הדבק קישור" onChange={(e) => { setLink(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') go(); }} />
        <button className="btn primary" onClick={() => go()}>כניסה</button>
      </div>
      <button className="btn block" style={{ marginTop: 10 }}
        onClick={async () => { try { const t = await navigator.clipboard.readText(); setLink(t); go(t); } catch { setErr('הדבק את הקישור בתיבה'); } }}>📋 הדבק מהלוח</button>
      {err && <div className="err">{err}</div>}
    </Sheet>
  );
}
