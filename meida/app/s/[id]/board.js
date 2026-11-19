'use client';
import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import { SeenLine } from '@/components/Seen';
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
export const fmtDate = (s) => new Date(s.length === 10 ? s + 'T12:00:00' : s).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
export const fmtDateTime = (s) => new Date(s).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });

function PostCard({ p, ctx, fresh }) {
  const k = kindOf(p.kind);
  const mine = p.author_id === ctx.me;
  const canEdit = mine || ctx.isAdmin;
  const needAck = p.urgent && !mine && !ctx.iSaw('post', p.id);
  const replies = ctx.replies.filter((r) => r.post_id === p.id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function ack() {
    setBusy(true);
    try { await api.markSeen(ctx.shopId, 'post', [p.id]); await ctx.refresh(); ctx.notify({ ack: p.id }); ctx.toast(`אישרת ✓ ${p.author_name} יודע שראית`); }
    catch (e) { ctx.toast(errText(e)); }
    setBusy(false);
  }
  async function reply() {
    if (!text.trim()) return;
    setBusy(true);
    try { const r = await api.reply(ctx.shopId, p.id, text.trim()); ctx.apply('replies', r); ctx.notify({ reply: r.id }); setText(''); ctx.toast('התגובה נשלחה ✓'); }
    catch (e) { ctx.toast(errText(e)); }
    setBusy(false);
  }
  async function delReply(r) {
    if (!confirm('למחוק את התגובה?')) return;
    try { await api.deleteReply(ctx.shopId, r.id); ctx.apply('replies', { ...r, deleted_at: new Date().toISOString() }); } catch (e) { ctx.toast(errText(e)); }
  }
  async function del() {
    if (!confirm('למחוק את ההודעה?')) return;
    try { await api.deletePost(ctx.shopId, p.id); ctx.applyPost({ ...p, deleted_at: new Date().toISOString() }); ctx.toast('נמחקה'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <div className={'card srow post2' + (p.urgent ? ' urg' : fresh ? ' fresh' : '')}>
      <div>
        <div className="row wrap-row" style={{ gap: 6 }}>
          {p.urgent && <span className="pill p-out">🚨 דחוף</span>}
          {p.kind !== 'message' && <span className="pill p-gray">{k.e} {k.label}</span>}
          {p.pinned && <span className="small">📌</span>}
          {fresh && !p.urgent && <span className="pill p-blue">חדש</span>}
        </div>
        {p.title && <div className="post-title">{p.title}</div>}
        {p.body && <RichText text={p.body} ctx={ctx} />}
        {p.photos?.length > 0 && <div className="photos" style={{ marginTop: 6 }}>{p.photos.map((x) => <a key={x} href={x} target="_blank" rel="noreferrer"><img src={x} alt="" style={{ height: 90 }} /></a>)}</div>}
        <div className="muted small" style={{ marginTop: 4 }}>{mine ? 'אני' : p.author_name} · {timeAgo(p.created_at)}{p.remind_at ? ` · ⏰ ${fmtDateTime(p.remind_at)}` : ''}</div>
      </div>
      <SeenLine ctx={ctx} refType="post" row={p} authorId={p.author_id} title={p.title || p.body} />
      {needAck && <button className="btn ok block" disabled={busy} onClick={ack}>✓ ראיתי — {p.author_name} יידע</button>}
      {replies.length > 0 && (
        <div className="replies">
          {replies.map((r) => (
            <div key={r.id} className="reply-b">
              <b>{r.by_id === ctx.me ? 'אני' : r.by_name}:</b> {r.body} <span className="muted small">{timeAgo(r.created_at)}</span>
              {(r.by_id === ctx.me || ctx.isAdmin) && <button className="x" onClick={() => delReply(r)} aria-label="מחיקה">✕</button>}
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <input className="input sm grow" placeholder="תגובה…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') reply(); }} />
        <button className="btn sm" disabled={busy || !text.trim()} onClick={reply}>שליחה</button>
        {canEdit && <button className="btn sm" onClick={() => ctx.open({ t: 'post', post: p })} aria-label="עריכה">✏️</button>}
        {canEdit && <button className="btn sm danger" onClick={del} aria-label="מחיקה">🗑️</button>}
      </div>
    </div>
  );
}

export default function Board({ ctx }) {
  const [q, setQ] = useState('');
  // מה שלא ראיתי ברגע הפתיחה — נשאר מסומן "חדש" עד שסוגרים
  const [freshIds] = useState(() => new Set(ctx.posts.filter((p) => p.author_id !== ctx.me && !ctx.iSaw('post', p.id)).map((p) => p.id)));
  useEffect(() => {
    // פתיחת המסך = ראיתי (חוץ מהודעה דחופה — שם צריך ללחוץ "ראיתי")
    ctx.markSeen('post', ctx.posts.filter((p) => !p.deleted_at && !p.urgent), 'author_id');
    api.seenPosts(ctx.shopId).catch(() => {});
  }, [ctx.posts.length]); // eslint-disable-line

  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return ctx.posts.filter((p) => !p.deleted_at)
      .filter((p) => !w || `${p.title} ${p.body} ${p.author_name}`.toLowerCase().includes(w))
      .sort((a, b) => (b.urgent && !ctx.iSaw('post', b.id)) - (a.urgent && !ctx.iSaw('post', a.id)) || (b.pinned - a.pinned) || new Date(b.created_at) - new Date(a.created_at));
  }, [ctx.posts, q]); // eslint-disable-line

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head">
        <h2>הודעות</h2>
        <button className="btn primary sm" onClick={() => ctx.open({ t: 'post' })}>➕ הודעה חדשה</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <PushToggle ctx={ctx} compact />
      {ctx.posts.length > 4 && (
        <div className="search" style={{ marginTop: 8 }}>
          <span>🔎</span>
          <input className="input" style={{ height: 42, fontSize: 15 }} placeholder="חיפוש בהודעות" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {!list.length && (
        <div className="empty"><div className="e">📭</div>אין הודעות
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => ctx.open({ t: 'post' })}>➕ הודעה לכל הצוות</button></div></div>
      )}
      <div className="list" style={{ marginTop: 8 }}>
        {list.map((p) => <PostCard key={p.id} p={p} ctx={ctx} fresh={freshIds.has(p.id)} />)}
      </div>
    </Sheet>
  );
}
