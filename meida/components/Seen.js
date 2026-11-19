'use client';
import Sheet from './Sheet';
import { EyeIcon } from './Icons';
import { hueOf, timeAgo } from '@/lib/kb';

const Av = ({ name, big }) => <span className={'av' + (big ? ' lg' : '')} style={{ background: hueOf(name) }}>{String(name || '?').charAt(0)}</span>;

// שורה קטנה: מי ראה (עיגולים עם שמות), "כולם ראו", או "עוד אף אחד לא ראה"
export function SeenLine({ ctx, refType, row, authorId, title }) {
  const others = ctx.members.filter((m) => m.user_id !== authorId);
  if (!others.length) return null;
  const saw = ctx.seenOf(refType, row.id).filter((s) => s.user_id !== authorId);
  const mine = authorId === ctx.me;
  const go = (e) => { e.stopPropagation(); ctx.open({ t: 'seen', ref: refType, row, authorId, title }); };
  if (!saw.length) return <button className="seen warn" onClick={go}><EyeIcon /> {mine ? 'עוד אף אחד לא ראה' : 'עוד לא נראה'}</button>;
  const all = others.every((m) => saw.some((s) => s.user_id === m.user_id));
  return (
    <button className="seen" onClick={go}>
      <EyeIcon />
      <span className="avs">{saw.slice(0, 5).map((s) => <Av key={s.user_id} name={s.name} />)}</span>
      {all ? 'כולם ראו' : `ראו ${saw.length} מתוך ${others.length}`}
    </button>
  );
}

export function SeenSheet({ ctx, refType, row, authorId, title }) {
  const saw = ctx.seenOf(refType, row.id).filter((s) => s.user_id !== authorId).sort((a, b) => new Date(a.at) - new Date(b.at));
  const not = ctx.members.filter((m) => m.user_id !== authorId && !saw.some((s) => s.user_id === m.user_id));
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>מי ראה</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {title && <div className="muted small">{title}</div>}
      <div className="card" style={{ marginTop: 10, padding: '2px 14px' }}>
        {saw.map((s) => (
          <div key={s.user_id} className="who-row"><Av name={s.name} big /><div className="grow"><b>{s.user_id === ctx.me ? 'אני' : s.name}</b><div className="muted small">ראה {timeAgo(s.at)}</div></div><span className="pill p-in">ראה ✓</span></div>
        ))}
        {not.map((m) => (
          <div key={m.user_id} className="who-row"><Av name={m.name} big /><div className="grow"><b>{m.user_id === ctx.me ? 'אני' : m.name}</b><div className="muted small">עוד לא פתח</div></div><span className="pill p-low">לא ראה</span></div>
        ))}
      </div>
    </Sheet>
  );
}
