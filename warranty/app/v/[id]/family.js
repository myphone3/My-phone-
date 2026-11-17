'use client';
import { useEffect, useState } from 'react';
import Sheet from '@/components/Sheet';
import { rpc } from '@/lib/lock';
import { supabase } from '@/lib/supabase';
import { useUser, signInWithGoogle, signOut, userName, GoogleButton } from '@/lib/auth';
import { downloadZip, downloadCsv } from '@/lib/backup';

// חשבון, משפחה וגיבוי
export default function FamilySheet({ vault, list, onClose, onVault, onLeft, say }) {
  const user = useUser();
  const [members, setMembers] = useState(null);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const link = typeof window !== 'undefined' ? `${location.origin}/v/${vault.id}` : '';

  useEffect(() => {
    if (!vault.has_owner) return;
    rpc('wr_members_list', vault.id).then(({ data }) => setMembers(data || []));
  }, [vault.id, vault.has_owner]);

  async function claim() {
    setBusy('claim');
    const { data, error } = await rpc('wr_claim', vault.id);
    setBusy('');
    if (error || data?.error) return say('לא הצלחנו לשמור בחשבון, נסה שוב');
    onVault({ ...vault, has_owner: true, is_owner: true });
    say('✅ הארכיון נשמר בחשבון שלך');
  }
  async function remove(m) {
    if (!confirm(`להסיר את ${m.name || m.email}?\nהוא לא יוכל להיכנס יותר לארכיון.`)) return;
    const { error } = await rpc('wr_member_remove', vault.id, { p_user: m.user_id });
    if (error) return say('לא הוסר, נסה שוב');
    setMembers((l) => l.filter((x) => x.user_id !== m.user_id));
    say('הוסר');
  }
  async function toggleJoin() {
    const v = !vault.allow_join;
    const { error } = await rpc('wr_set_allow_join', vault.id, { p_allow: v });
    if (error) return say('לא נשמר');
    onVault({ ...vault, allow_join: v });
  }
  async function leave() {
    if (!confirm('לצאת מהארכיון? לא תוכל לראות את הקבלות עד שתצטרף שוב.')) return;
    await supabase.rpc('wr_leave', { p_vault: vault.id });
    onLeft();
  }
  async function zip() {
    setBusy('zip'); setProg([0, 0]);
    try {
      const r = await downloadZip(vault.name, list, (d, t) => setProg([d, t]));
      say(r.failed ? `💾 הגיבוי ירד (${r.failed} קבצים לא ירדו)` : '💾 הגיבוי ירד לטלפון');
    } catch { say('הגיבוי נכשל, נסה שוב'); }
    setBusy(''); setProg(null);
  }
  function invite() {
    const t = `הצטרפו לארכיון הקבלות "${vault.name}" 🧾\nנכנסים עם חשבון Google ורואים את כל הקבלות והאחריות:\n${link}`;
    location.href = 'https://wa.me/?text=' + encodeURIComponent(t);
  }

  return (
    <Sheet onClose={onClose}>
      <h3>👥 חשבון, משפחה וגיבוי</h3>

      {user === null && (
        <div className="card" style={{ padding: 14 }}>
          <b>🔐 שמירה בחשבון Google</b>
          <div className="muted small" style={{ margin: '4px 0 10px' }}>נכנסים מכל טלפון עם אותו חשבון, ולא מאבדים את הקבלות כשמחליפים מכשיר</div>
          <GoogleButton onClick={() => { setBusy('g'); signInWithGoogle(`/v/${vault.id}?claim=1`).catch(() => setBusy('')); }} busy={busy === 'g'} />
        </div>
      )}
      {user && (
        <div className="acct">
          <div className="av">{user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" /> : userName(user).slice(0, 1)}</div>
          <div className="grow"><b>{userName(user)}</b><div className="muted small" dir="ltr" style={{ textAlign: 'right' }}>{user.email}</div></div>
          <button className="btn sm" onClick={async () => { await signOut(); location.reload(); }}>יציאה</button>
        </div>
      )}
      {user && !vault.has_owner && (
        <button className="banner" onClick={claim} disabled={busy === 'claim'}>
          <span className="ic">☁️</span>
          <span className="grow"><b>{busy === 'claim' ? 'שומר…' : 'לשמור את הארכיון הזה בחשבון שלי'}</b><div className="muted small">מעכשיו רק מי שמחובר ושייך לארכיון יוכל להיכנס</div></span>
        </button>
      )}

      {vault.has_owner && (
        <>
          <div className="sec">מי רואה את הקבלות</div>
          {!members ? <div className="spin" style={{ width: 24, height: 24, margin: 10 }} /> : (
            <div className="menu-list">
              {members.map((m) => (
                <div key={m.user_id} className="row" style={{ padding: '10px 4px', borderBottom: '1px solid var(--line)' }}>
                  <div className="acct" style={{ border: 0, padding: 0, background: 'none' }}><div className="av" style={{ width: 32, height: 32, fontSize: 14 }}>{(m.name || m.email || '?').slice(0, 1)}</div></div>
                  <div className="grow"><b>{m.name || m.email}{m.me ? ' (אני)' : ''}</b><div className="muted small">{m.role === 'owner' ? '👑 בעלים' : 'חבר'} · <span dir="ltr">{m.email}</span></div></div>
                  {vault.is_owner && m.role !== 'owner' && <button className="btn sm danger" onClick={() => remove(m)}>הסר</button>}
                </div>
              ))}
            </div>
          )}
          <div className="grid2" style={{ marginTop: 10 }}>
            <button className="btn" onClick={invite}>💬 הזמנה בוואטסאפ</button>
            <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(link); say('🔗 הקישור הועתק'); } catch { prompt('העתק:', link); } }}>🔗 העתק קישור</button>
          </div>
          <div className="muted small" style={{ margin: '8px 4px 0' }}>מי שמקבל את הקישור נכנס עם Google ומצטרף. אתה רואה כאן את כולם ויכול להסיר.</div>
          {vault.is_owner && (
            <button className="toggle" onClick={toggleJoin}>
              <span className="ic">🚪</span>
              <span className="grow"><b>אפשר להצטרף עם הקישור</b><div className="muted small">{vault.allow_join ? 'פתוח — מי שמקבל קישור יכול להצטרף' : 'סגור — אף אחד חדש לא יכול להצטרף'}</div></span>
              <span className={'switch' + (vault.allow_join ? ' on' : '')} />
            </button>
          )}
          {!vault.is_owner && <button className="btn danger block" style={{ marginTop: 10 }} onClick={leave}>יציאה מהארכיון</button>}
        </>
      )}

      <div className="sec">💾 גיבוי</div>
      <div className="muted small" style={{ margin: '0 4px 8px' }}>הקבלות שמורות בענן. בנוסף אפשר להוריד עותק לטלפון / למחשב.</div>
      <div className="menu-list">
        <button onClick={zip} disabled={!list.length || busy === 'zip'}>
          <span className="ic">🗜️</span>
          <span className="grow"><b>גיבוי מלא (ZIP)</b><div className="muted small">{prog ? `מוריד ${prog[0]} מתוך ${prog[1]} קבצים…` : 'כל הקבלות עם התמונות וה-PDF, תיקייה לכל מוצר + אקסל'}</div></span>
        </button>
        <button onClick={() => downloadCsv(list)} disabled={!list.length}><span className="ic">📊</span><span className="grow"><b>רק אקסל</b><div className="muted small">רשימת כל הקבלות והפרטים</div></span></button>
      </div>
    </Sheet>
  );
}
