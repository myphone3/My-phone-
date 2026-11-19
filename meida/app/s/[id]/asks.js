'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { SeenLine } from '@/components/Seen';
import { api, errText, uploadPhoto } from '@/lib/api';
import { shrink } from '@/lib/image';
import { timeAgo, ASK_KINDS, askKind, ils } from '@/lib/kb';

export { ils };
export const waitingOf = (a) => !a.deleted_at && a.status === 'open' && !(a.answers || []).length;
export const needsAnswer = (a, ctx) => waitingOf(a) && a.asked_by !== ctx.me;

function AnswerForm({ a, ctx }) {
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isPrice = (a.kind || 'price') === 'price';
  async function send() {
    const p = price.replace(/[^\d.]/g, '');
    if (!p && !note.trim()) return;
    setBusy(true);
    try {
      const x = await api.answer(ctx.shopId, a.id, p ? Number(p) : null, note.trim());
      ctx.applyAsk({ ...a, status: a.status === 'open' ? 'answered' : a.status, answers: [...(a.answers || []), x] });
      ctx.notify({ ask: a.id, answer: x.id });
      setPrice(''); setNote(''); ctx.toast('התשובה נשלחה ✓');
    } catch (e) { ctx.toast(errText(e)); }
    setBusy(false);
  }
  return (
    <div className="answer-form">
      <div className="row">
        {isPrice && <div className="price-in"><span>₪</span><input className="input" inputMode="decimal" placeholder="סכום" value={price} onChange={(e) => setPrice(e.target.value)} /></div>}
        <input className="input grow" placeholder={isPrice ? 'הערה (לא חובה)' : a.kind === 'stock' ? 'יש / אין / איפה…' : 'התשובה…'} value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <button className="btn primary" disabled={busy || (!price.trim() && !note.trim())} onClick={send}>{busy ? '…' : 'שליחה'}</button>
      </div>
      {a.kind === 'stock' && (
        <div className="row" style={{ marginTop: 6 }}>
          {['יש ✓', 'אין ✗', 'יש במחסן'].map((t) => <button key={t} className="chip" onClick={() => setNote(t)}>{t}</button>)}
        </div>
      )}
    </div>
  );
}

function AskCard({ a, ctx }) {
  const mine = a.asked_by === ctx.me;
  const canEdit = mine || ctx.isAdmin;
  const [photo, setPhoto] = useState(null);
  const k = askKind(a.kind);
  async function act(action) {
    if (action === 'delete' && !confirm('למחוק את השאלה?')) return;
    try {
      await api.askSet(ctx.shopId, a.id, action);
      ctx.applyAsk(action === 'delete' ? { ...a, deleted_at: new Date().toISOString() } : { ...a, status: action === 'close' ? 'closed' : 'open' });
    } catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <div className={'card srow' + (a.status === 'closed' ? ' done' : '')}>
      <div className="top2">
        {a.photos?.[0] ? <img className="ask-ph" src={a.photos[0]} alt="" onClick={() => setPhoto(a.photos[0])} /> : <span className="e">{k.e}</span>}
        <div className="grow">
          <b>{a.product || 'מה המחיר?'}</b>
          {a.note && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.note}</div>}
          <div className="muted small">{k.label} · {mine ? 'אני' : a.asked_by_name} · {timeAgo(a.created_at)}</div>
        </div>
        <span className={'pill ' + (waitingOf(a) ? 'p-low' : a.status === 'closed' ? 'p-gray' : 'p-in')}>{waitingOf(a) ? 'מחכה' : a.status === 'closed' ? 'סגור' : 'נענה'}</span>
      </div>
      <SeenLine ctx={ctx} refType="ask" row={a} authorId={a.asked_by} title={a.product} />
      {(a.answers || []).map((x) => (
        <div key={x.id} className="ans-b">
          {x.price !== null && x.price !== undefined && <b className="price">{ils(x.price)}</b>}
          <span className="grow">{x.note}</span>
          <span className="muted small">{x.by_id === ctx.me ? 'אני' : x.by_name} · {timeAgo(x.created_at)}</span>
        </div>
      ))}
      {a.status !== 'closed' && !mine && <AnswerForm a={a} ctx={ctx} />}
      {canEdit && (
        <div className="row">
          {a.status !== 'closed' ? <button className="btn sm" onClick={() => act('close')}>✓ סגירה</button> : <button className="btn sm" onClick={() => act('reopen')}>↩ פתיחה מחדש</button>}
          <button className="btn sm danger" onClick={() => act('delete')}>🗑️</button>
        </div>
      )}
      {photo && <div className="sheet-bg" style={{ alignItems: 'center', zIndex: 80 }} onClick={() => setPhoto(null)}><img src={photo} alt="" style={{ maxWidth: '100%', maxHeight: '92vh' }} /></div>}
    </div>
  );
}

export default function AsksTab({ ctx }) {
  const [f, setF] = useState('all');
  const list = useMemo(() => ctx.asks.filter((a) => !a.deleted_at && (f === 'all' || (a.kind || 'price') === f))
    .sort((a, b) => needsAnswer(b, ctx) - needsAnswer(a, ctx) || new Date(b.created_at) - new Date(a.created_at)), [ctx.asks, f]); // eslint-disable-line
  useEffect(() => { ctx.markSeen('ask', ctx.asks.filter((a) => !a.deleted_at && a.status !== 'closed'), 'asked_by'); }, [ctx.asks.length]); // eslint-disable-line
  return (
    <>
      <button className="btn primary big block" onClick={() => ctx.open({ t: 'ask-new' })}>➕ שאלה חדשה</button>
      <div className="seg" style={{ marginTop: 10 }}>
        <button className={f === 'all' ? 'on' : ''} onClick={() => setF('all')}>הכל</button>
        {ASK_KINDS.map((k) => <button key={k.k} className={f === k.k ? 'on' : ''} onClick={() => setF(k.k)}>{k.e} {k.label}</button>)}
      </div>
      <div className="list" style={{ marginTop: 10 }}>
        {!list.length && <div className="empty"><div className="e">💬</div>אין שאלות<div className="muted small" style={{ marginTop: 6 }}>שואלים את כל הצוות: כמה זה עולה, יש לנו במלאי, או כל שאלה. כולם מקבלים התראה ומי שיודע עונה.</div></div>}
        {list.map((a) => <AskCard key={a.id} a={a} ctx={ctx} />)}
      </div>
    </>
  );
}

export function AskNew({ ctx, kind: k0, text }) {
  const [kind, setKind] = useState(k0 || 'price');
  const [product, setProduct] = useState(text || '');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const camRef = useRef(null);
  async function add(files) {
    setBusy('photo'); setErr('');
    try { const u = []; for (const f of [...files].slice(0, 4)) u.push(await uploadPhoto(await shrink(f))); setPhotos((p) => [...p, ...u]); }
    catch (e) { setErr('העלאת התמונה נכשלה: ' + errText(e)); }
    setBusy('');
  }
  async function send() {
    if (!product.trim() && !photos.length) { setErr('כתוב את השאלה או צלם'); return; }
    setBusy('send'); setErr('');
    try {
      const a = await api.ask(ctx.shopId, { kind, product: product.trim(), note: note.trim(), photos });
      ctx.applyAsk(a);
      ctx.notify({ ask: a.id });
      ctx.toast('נשלח לכל הצוות ✓');
      ctx.close();
      ctx.setTab('asks');
    } catch (e) { setErr(errText(e)); setBusy(''); }
  }
  const ph = { price: 'כמה עולה…', stock: 'יש לנו…', general: 'מישהו יודע אם…' }[kind];
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>💬 שאלה לצוות</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <label className="lbl" style={{ marginTop: 0 }}>על מה?</label>
      <div className="choices three">{ASK_KINDS.map((x) => <button key={x.k} className={'choice' + (kind === x.k ? ' on' : '')} onClick={() => setKind(x.k)}>{x.e} {x.label}</button>)}</div>
      <label className="lbl">השאלה</label>
      <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder={ph} autoFocus />
      <label className="lbl">פרטים (לא חובה)</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: הלקוח מחכה בחנות" />
      <label className="lbl">צילום (לא חובה)</label>
      <div className="photos">
        {photos.map((x) => <div className="ph-edit" key={x}><img src={x} alt="" style={{ height: 80 }} /><button onClick={() => setPhotos(photos.filter((y) => y !== x))}>✕</button></div>)}
        <button className="btn" style={{ height: 80, width: 80, flex: 'none' }} disabled={busy === 'photo'} onClick={() => camRef.current?.click()}>{busy === 'photo' ? <span className="spin sm" /> : '📷'}</button>
        <input ref={camRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
      </div>
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={!!busy} onClick={send}>{busy === 'send' ? 'שולח…' : 'שליחה לכל הצוות'}</button>
      <div className="muted small center" style={{ marginTop: 6 }}>כולם מקבלים התראה. כשמישהו עונה — תקבל התראה.</div>
    </Sheet>
  );
}

