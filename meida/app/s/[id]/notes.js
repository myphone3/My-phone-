'use client';
import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import CoLogo from '@/components/CoLogo';
import { SeenLine } from '@/components/Seen';
import { api, errText } from '@/lib/api';
import { NOTE_KINDS, NOTE_ST, noteKind, timeAgo, fmtWhen, telHref } from '@/lib/kb';

export default function NotesTab({ ctx }) {
  const [f, setF] = useState('open');
  const list = useMemo(() => ctx.notes.filter((x) => (f === 'open' ? x.status !== 'done' : f === 'want' ? x.kind === 'want' && x.status !== 'done' : x.status === 'done'))
    .sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || new Date(b.created_at) - new Date(a.created_at)), [ctx.notes, f]);
  useEffect(() => { ctx.markSeen('note', ctx.notesOpen, 'author_id'); }, [ctx.notes.length]); // eslint-disable-line
  const wantN = ctx.notes.filter((x) => x.kind === 'want' && x.status !== 'done').length;

  async function act(x, a) {
    if (a === 'delete' && !confirm('למחוק את הפתק?')) return;
    try {
      const r = await api.noteSet(ctx.shopId, x.id, a);
      ctx.apply('notes', r);
      ctx.toast({ done: 'טופל ✓', doing: 'סומן שאתה מטפל', plus: `ביקשו ${r.times} פעמים`, reopen: 'נפתח מחדש', delete: 'נמחק' }[a]);
    } catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <>
      <button className="btn primary big block" onClick={() => ctx.open({ t: 'note' })}>➕ פתק חדש</button>
      <div className="seg" style={{ marginTop: 10 }}>
        <button className={f === 'open' ? 'on' : ''} onClick={() => setF('open')}>פתוח ({ctx.notesOpen.length})</button>
        <button className={f === 'want' ? 'on' : ''} onClick={() => setF('want')}>🛒 ביקשו ({wantN})</button>
        <button className={f === 'done' ? 'on' : ''} onClick={() => setF('done')}>טופל</button>
      </div>
      <div className="list" style={{ marginTop: 10 }}>
        {!list.length && <div className="empty"><div className="e">✅</div>{f === 'done' ? 'אין כאן כלום' : 'הכל טופל'}<div className="muted small" style={{ marginTop: 6 }}>פתק = כמו פתק שמדביקים בצד: נשאר עד שמישהו מסמן ✓ טופל.</div></div>}
        {list.map((x) => {
          const k = noteKind(x.kind);
          const st = NOTE_ST[x.status];
          const co = ctx.tagsById[x.company_id];
          return (
            <div key={x.id} className={'card srow' + (x.status === 'waiting' ? ' note-y' : '')}>
              <div className="top2">
                <span className="e">{k.e}</span>
                <div className="grow">
                  <b>{x.title}</b>
                  <div className="muted small">{[k.label, co?.name, x.customer, x.times > 1 && `ביקשו ${x.times} פעמים`, `${x.author_name}, ${timeAgo(x.created_at)}`, x.status !== 'waiting' && x.handler_name && `${st.label}: ${x.handler_name}`].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={'pill ' + st.cls}>{st.label}</span>
              </div>
              <SeenLine ctx={ctx} refType="note" row={x} authorId={x.author_id} title={x.title} />
              {x.remind_at && x.status !== 'done' && <div className="remind">⏰ תזכורת: {fmtWhen(x.remind_at)}{x.remind_to === 'me' ? ' (רק לי)' : ''}{x.reminded_at ? ' · נשלחה' : ''}</div>}
              {x.kind === 'want' && x.times >= 3 && x.status !== 'done' && (
                <div className="suggest">💡 ביקשו {x.times} פעמים. אולי להוסיף לחוסרים?<span className="grow" />
                  <button className="btn sm blue" onClick={() => ctx.open({ t: 'report', name: x.title, company_id: x.company_id, fromNote: x.id })}>📦 להוסיף לחוסר</button></div>
              )}
              {x.status !== 'done' ? (
                <div className="row wrap-row">
                  {x.phone && <a className="btn sm" href={telHref(x.phone)}>📞 {x.phone}</a>}
                  {x.kind === 'want' && <button className="btn sm" onClick={() => act(x, 'plus')}>+1 עוד לקוח ביקש</button>}
                  <span className="grow" />
                  <button className="btn sm" onClick={() => ctx.open({ t: 'note', note: x })} aria-label="עריכה">✏️</button>
                  {x.status === 'waiting' && <button className="btn sm blue" onClick={() => act(x, 'doing')}>אני מטפל</button>}
                  <button className="btn sm ok" onClick={() => act(x, 'done')}>✓ טופל</button>
                </div>
              ) : (
                <div className="row">
                  <button className="btn sm" onClick={() => act(x, 'reopen')}>↩ פתיחה מחדש</button>
                  {(x.author_id === ctx.me || ctx.isAdmin) && <button className="btn sm danger" onClick={() => act(x, 'delete')}>🗑️</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
function preset(k) {
  const d = new Date();
  if (k === 'hour') d.setHours(d.getHours() + 1);
  if (k === 'eve') { d.setHours(17, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); }
  if (k === 'tom') { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); }
  return d.toISOString();
}

export function NoteEditor({ ctx, note }) {
  const [n, setN] = useState(() => ({ kind: 'check', title: '', customer: '', phone: '', company_id: '', remind_at: '', remind_to: 'all', ...(note || {}) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setN((x) => ({ ...x, [k]: v }));
  async function save() {
    if (!n.title.trim()) { setErr(n.kind === 'want' ? 'איזה מוצר ביקשו?' : 'מה צריך לעשות?'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.saveNote(ctx.shopId, { id: note?.id, kind: n.kind, title: n.title.trim(), customer: n.customer.trim(), phone: n.phone.trim(), company_id: n.company_id || '', remind_at: n.remind_at || '', remind_to: n.remind_to });
      ctx.apply('notes', r);
      if (!note) ctx.notify({ note: r.id });
      ctx.toast(r.remind_at ? `נשמר ✓ תזכורת: ${fmtWhen(r.remind_at)}` : 'הפתק נשמר ✓');
      ctx.close();
      if (!note) ctx.setTab('notes');
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>📌 {note ? 'עריכת פתק' : 'פתק פתוח'}</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <div className="muted small">כמו פתק שמדביקים בצד — נשאר עד שמסמנים ✓ טופל</div>
      <label className="lbl">מה זה?</label>
      <div className="choices three">{NOTE_KINDS.map((k) => <button key={k.k} className={'choice' + (n.kind === k.k ? ' on' : '')} onClick={() => set('kind', k.k)}>{k.e} {k.label}</button>)}</div>
      <label className="lbl">{n.kind === 'want' ? 'איזה מוצר ביקשו?' : 'מה צריך לעשות?'}</label>
      <input className="input" value={n.title} onChange={(e) => set('title', e.target.value)} autoFocus={!note}
        placeholder={n.kind === 'want' ? 'למשל: כיסוי ספר ל-S24 FE' : n.kind === 'call' ? 'למשל: להתקשר כשהמכשיר חוזר מהמעבדה' : 'למשל: לבדוק מול סלקום למה הסים לא עובד'} />
      {n.kind !== 'check' && <>
        <label className="lbl">לקוח (לא חובה)</label>
        <div className="row"><input className="input grow" placeholder="שם" value={n.customer} onChange={(e) => set('customer', e.target.value)} /><input className="input grow ltr" inputMode="tel" placeholder="טלפון" value={n.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      </>}
      <label className="lbl">מול איזו חברה? (לא חובה)</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {ctx.companies.map((c) => <button key={c.id} className={'chip' + (n.company_id === c.id ? ' on' : '')} onClick={() => set('company_id', n.company_id === c.id ? '' : c.id)}><CoLogo co={c} size={20} /> {c.name}</button>)}
      </div>
      <label className="lbl">⏰ תזכורת (לא חובה)</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        <button className={'chip' + (!n.remind_at ? ' on' : '')} onClick={() => set('remind_at', '')}>בלי</button>
        {[['hour', 'בעוד שעה'], ['eve', 'היום ב-17:00'], ['tom', 'מחר ב-10:00']].map(([k, l]) => <button key={k} className="chip" onClick={() => set('remind_at', preset(k))}>{l}</button>)}
      </div>
      <input className="input" type="datetime-local" style={{ marginTop: 6 }} value={toLocal(n.remind_at)} onChange={(e) => set('remind_at', e.target.value ? new Date(e.target.value).toISOString() : '')} />
      {n.remind_at && (
        <>
          <div className="muted small" style={{ marginTop: 4 }}>התראה ב-{fmtWhen(n.remind_at)}</div>
          <div className="tabs">
            <button className={'tab' + (n.remind_to === 'all' ? ' on' : '')} onClick={() => set('remind_to', 'all')}>👥 לכל העובדים</button>
            <button className={'tab' + (n.remind_to === 'me' ? ' on' : '')} onClick={() => set('remind_to', 'me')}>🙋 רק לי</button>
          </div>
        </>
      )}
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={save}>{busy ? 'שומר…' : 'שמירה'}</button>
    </Sheet>
  );
}
