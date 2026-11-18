'use client';
import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText } from '@/lib/api';
import { timeAgo } from '@/lib/kb';
import { RichText } from './item';
import PushToggle from '@/components/PushToggle';

export const POST_KINDS = [
  { k: 'message', label: 'הודעה', e: '💬' },
  { k: 'promo', label: 'מבצע', e: '🏷️' },
  { k: 'stock', label: 'מלאי', e: '📦' },
  { k: 'task', label: 'משימה', e: '✅' },
  { k: 'reminder', label: 'תזכורת', e: '⏰' },
];
export const kindOf = (k) => POST_KINDS.find((x) => x.k === k) || POST_KINDS[0];

const dayKey = (iso) => new Date(iso).toDateString();
function dayLabel(iso) {
  const d = new Date(iso); const t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'היום';
  if (d.toDateString() === y.toDateString()) return 'אתמול';
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric', year: d.getFullYear() === t.getFullYear() ? undefined : '2-digit' });
}
export const fmtDate = (s) => new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
export const fmtDateTime = (s) => new Date(s).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const todayStr = () => new Date().toLocaleDateString('en-CA');

export function isUnread(p, ctx) {
  return !p.deleted_at && p.author_id !== ctx.user?.id && ctx.shop.seen_at && new Date(p.created_at) > new Date(ctx.shop.seen_at);
}

function PostCard({ p, ctx, fresh }) {
  const k = kindOf(p.kind);
  const mine = p.author_id === ctx.user?.id;
  const canEdit = mine || ctx.isAdmin;
  const expired = p.due && p.due < todayStr();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try { const r = await api.postStatus(ctx.shopId, p.id, p.status === 'done' ? 'open' : 'done'); ctx.applyPost(r); }
    catch (e) { ctx.toast(errText(e)); }
    setBusy(false);
  }
  async function del() {
    if (!confirm('למחוק את ההודעה?')) return;
    try { await api.deletePost(ctx.shopId, p.id); ctx.applyPost({ ...p, deleted_at: new Date().toISOString() }); ctx.toast('נמחקה'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <div className={'card post k-' + p.kind + (p.status === 'done' ? ' done' : '') + (expired ? ' expired' : '')}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <div className="row wrap-row" style={{ gap: 6 }}>
            <span className={'pk pk-' + p.kind}>{k.e} {k.label}</span>
            {p.pinned && <span className="small">📌</span>}
            {fresh && <span className="new-badge">חדש</span>}
            {p.status === 'done' && <span className="pk pk-done">✓ טופל</span>}
            {expired && <span className="pk pk-old">פג תוקף</span>}
          </div>
          {p.title && <div className="post-title">{p.title}</div>}
        </div>
      </div>
      {p.body && <div style={{ marginTop: 4 }}><RichText text={p.body} ctx={ctx} /></div>}
      {p.photos?.length > 0 && <div className="photos" style={{ marginTop: 6 }}>{p.photos.map((x) => <a key={x} href={x} target="_blank" rel="noreferrer"><img src={x} alt="" style={{ height: 100 }} /></a>)}</div>}
      <div className="post-meta">
        {p.due && <span className={expired ? 'err' : ''} style={{ margin: 0 }}>📅 עד {fmtDate(p.due)}</span>}
        {p.remind_at && <span>⏰ {fmtDateTime(p.remind_at)}{p.remind_to === 'me' ? ' (רק לי)' : ''}{p.reminded_at ? ' · נשלחה' : ''}</span>}
        <span>{p.author_name} · {timeAgo(p.created_at)}</span>
        {p.status === 'done' && p.done_by_name && <span>✓ {p.done_by_name} {timeAgo(p.done_at)}</span>}
      </div>
      <div className="row wrap-row" style={{ marginTop: 8 }}>
        <button className={'btn sm ' + (p.status === 'done' ? '' : 'soft')} disabled={busy} onClick={toggle}>{p.status === 'done' ? '↩ לא טופל' : '✓ טופל'}</button>
        {canEdit && <button className="btn sm" onClick={() => ctx.open({ t: 'post', post: p })}>✏️ עריכה</button>}
        {canEdit && <button className="btn sm danger" onClick={del}>🗑️</button>}
      </div>
    </div>
  );
}

const FILTERS = [{ k: 'open', label: 'פתוחות' }, { k: 'all', label: 'הכל' }, { k: 'done', label: 'טופלו' }, ...POST_KINDS.map((x) => ({ k: x.k, label: x.e + ' ' + x.label }))];

export default function Board({ ctx }) {
  const [f, setF] = useState('open');
  const [q, setQ] = useState('');
  // מה היה "חדש" ברגע הפתיחה — נשאר מסומן עד שסוגרים
  const [seenAt] = useState(ctx.shop.seen_at);
  useEffect(() => {
    api.seenPosts(ctx.shopId).then(() => ctx.markSeen()).catch(() => {});
  }, []); // eslint-disable-line

  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return ctx.posts.filter((p) => !p.deleted_at)
      .filter((p) => (f === 'open' ? p.status === 'open' : f === 'done' ? p.status === 'done' : f === 'all' ? true : p.kind === f))
      .filter((p) => !w || `${p.title} ${p.body} ${p.author_name}`.toLowerCase().includes(w))
      .sort((a, b) => (b.pinned - a.pinned) || new Date(b.created_at) - new Date(a.created_at));
  }, [ctx.posts, f, q]);
  const counts = useMemo(() => ({ open: ctx.posts.filter((p) => !p.deleted_at && p.status === 'open').length }), [ctx.posts]);

  let lastDay = '';
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head">
        <h2>📣 הודעות ומשימות</h2>
        <button className="btn primary sm" onClick={() => ctx.open({ t: 'post' })}>➕ חדשה</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <PushToggle ctx={ctx} compact />
      <div className="search" style={{ marginTop: 8 }}>
        <span>🔎</span>
        <input className="input" style={{ height: 42, fontSize: 15 }} placeholder="חיפוש בהודעות" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {FILTERS.map((x) => <button key={x.k} className={'chip' + (f === x.k ? ' on' : '')} onClick={() => setF(x.k)}>{x.label}{x.k === 'open' && counts.open ? <span className="n"> {counts.open}</span> : null}</button>)}
      </div>
      {!list.length && (
        <div className="empty"><div className="e">📭</div>{f === 'open' ? 'אין הודעות פתוחות' : 'אין כאן כלום'}
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => ctx.open({ t: 'post' })}>➕ הודעה חדשה לכולם</button></div></div>
      )}
      {list.map((p) => {
        const dk = p.pinned ? 'pinned' : dayKey(p.created_at);
        const head = dk !== lastDay ? <div className="h2" key={'h' + dk}>{p.pinned ? '📌 נעוצות' : dayLabel(p.created_at)}</div> : null;
        lastDay = dk;
        const fresh = p.author_id !== ctx.user?.id && seenAt && new Date(p.created_at) > new Date(seenAt);
        return <div key={p.id}>{head}<PostCard p={p} ctx={ctx} fresh={fresh} /></div>;
      })}
    </Sheet>
  );
}
