'use client';
import { useMemo, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText, uploadPhoto, serverCall } from '@/lib/api';
import { shrink } from '@/lib/image';
import { timeAgo } from '@/lib/kb';

export const ils = (n) => (n === null || n === undefined || n === '' ? '' : `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 })}`);
// בירור שמחכה לי: פתוח, לא שלי, ועוד אין לו תשובה
// מחכה לתשובה = פתוח ואף אחד עוד לא ענה. ברגע שמישהו עונה — עובר להיסטוריה
export const waitingOf = (a) => !a.deleted_at && a.status === 'open' && !(a.answers || []).length;
export const needsAnswer = (a, ctx) => !a.deleted_at && a.status === 'open' && a.asked_by !== ctx.user?.id && !(a.answers || []).length;

function AnswerForm({ a, ctx }) {
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    const p = price.replace(/[^\d.]/g, '');
    if (!p && !note.trim()) return;
    setBusy(true);
    try {
      const x = await api.answer(ctx.shopId, a.id, p ? Number(p) : null, note.trim());
      ctx.applyAsk({ ...a, status: a.status === 'open' ? 'answered' : a.status, answers: [...(a.answers || []), x] });
      serverCall('/api/notify', { shop: ctx.shopId, ask: a.id, answer: x.id }).catch(() => {});
      setPrice(''); setNote(''); ctx.toast('התשובה נשלחה ✓');
    } catch (e) { ctx.toast(errText(e)); }
    setBusy(false);
  }
  return (
    <div className="answer-form">
      <div className="row">
        <div className="price-in"><span>₪</span><input className="input" inputMode="decimal" placeholder="סכום" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <input className="input grow" placeholder="הערה (לא חובה): יש במלאי, מחיר לחבר…" value={note} onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
      </div>
      <button className="btn primary block" style={{ marginTop: 6 }} disabled={busy || (!price.trim() && !note.trim())} onClick={send}>{busy ? 'שולח…' : 'שליחת מחיר'}</button>
    </div>
  );
}

function AskCard({ a, ctx }) {
  const mine = a.asked_by === ctx.user?.id;
  const canEdit = mine || ctx.isAdmin;
  const [answering, setAnswering] = useState(needsAnswer(a, ctx));
  const [photo, setPhoto] = useState(null);
  async function act(action) {
    if (action === 'delete' && !confirm('למחוק את הבירור?')) return;
    try {
      await api.askSet(ctx.shopId, a.id, action);
      ctx.applyAsk(action === 'delete' ? { ...a, deleted_at: new Date().toISOString() } : { ...a, status: action === 'close' ? 'closed' : 'open' });
    } catch (e) { ctx.toast(errText(e)); }
  }
  const first = (a.answers || [])[0];
  return (
    <div className={'card ask' + (a.status === 'closed' ? ' done' : '')}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
        {a.photos?.[0] && <img className="ask-ph" src={a.photos[0]} alt="" onClick={() => setPhoto(a.photos[0])} />}
        <div className="grow">
          <div className="row wrap-row" style={{ gap: 6 }}>
            <span className={'pk ' + (a.status === 'open' ? 'pk-stock' : a.status === 'answered' ? 'pk-done' : 'pk-old')}>
              {a.status === 'open' ? '❓ מחכה למחיר' : a.status === 'answered' ? '✓ נענה' : 'סגור'}
            </span>
          </div>
          <div className="post-title">{a.product || 'מה המחיר?'}</div>
          {a.note && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.note}</div>}
          <div className="post-meta"><span>שאל: {mine ? 'אני' : a.asked_by_name} · {new Date(a.created_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
        </div>
      </div>
      {a.photos?.length > 1 && <div className="photos" style={{ marginTop: 6 }}>{a.photos.slice(1).map((x) => <img key={x} src={x} alt="" style={{ height: 70 }} onClick={() => setPhoto(x)} />)}</div>}
      {(a.answers || []).map((x) => (
        <div key={x.id} className={'ans' + (x === first ? ' first' : '')}>
          <div className="ans-price">{x.price !== null && x.price !== undefined ? ils(x.price) : '—'}</div>
          <div className="grow">
            {x.note && <div>{x.note}</div>}
            <div className="muted small">{x.by_id === ctx.user?.id ? 'אני' : x.by_name} · {timeAgo(x.created_at)}{x === first && (a.answers.length > 1) ? ' · ראשון' : ''}</div>
          </div>
        </div>
      ))}
      {a.status !== 'closed' && (answering ? <AnswerForm a={a} ctx={ctx} /> : (
        <button className="btn sm soft" style={{ marginTop: 8 }} onClick={() => setAnswering(true)}>{(a.answers || []).length ? '+ עוד מחיר / תיקון' : '💰 לענות מחיר'}</button>
      ))}
      {canEdit && (
        <div className="row" style={{ marginTop: 8 }}>
          {a.status !== 'closed' ? <button className="btn sm" onClick={() => act('close')}>✓ סגירה</button> : <button className="btn sm" onClick={() => act('reopen')}>↩ פתיחה מחדש</button>}
          <button className="btn sm danger" onClick={() => act('delete')}>🗑️</button>
        </div>
      )}
      {photo && <div className="sheet-bg" style={{ alignItems: 'center', zIndex: 80 }} onClick={() => setPhoto(null)}><img src={photo} alt="" style={{ maxWidth: '100%', maxHeight: '92vh' }} /></div>}
    </div>
  );
}

export default function Asks({ ctx }) {
  const [f, setF] = useState('open');
  const list = useMemo(() => ctx.asks.filter((a) => !a.deleted_at)
    .filter((a) => (f === 'open' ? waitingOf(a) : f === 'mine' ? a.asked_by === ctx.user?.id : true))
    .sort((a, b) => needsAnswer(b, ctx) - needsAnswer(a, ctx) || new Date(b.created_at) - new Date(a.created_at)), [ctx.asks, f]); // eslint-disable-line
  const openN = ctx.asks.filter((a) => !a.deleted_at && waitingOf(a)).length;
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head">
        <h2>💰 בירור מחיר</h2>
        <button className="btn primary sm" onClick={() => ctx.open({ t: 'ask-new' })}>➕ לשאול</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <div className="chips" style={{ paddingTop: 0 }}>
        {[['open', `⏳ מחכים לתשובה${openN ? ' ' + openN : ''}`], ['all', '🕘 היסטוריה'], ['mine', '🙋 שלי']].map(([k, l]) => (
          <button key={k} className={'chip' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>
      {!list.length && (
        <div className="empty"><div className="e">💰</div>{f === 'open' ? 'אין בירורים שמחכים לתשובה 👍' : 'אין כאן כלום'}
          <div className="muted small" style={{ marginTop: 6 }}>מצלמים מוצר ושואלים — כל העובדים מקבלים התראה, ומי שיודע עונה.</div>
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => ctx.open({ t: 'ask-new' })}>📷 לשאול מחיר</button></div></div>
      )}
      {list.map((a) => <AskCard key={a.id} a={a} ctx={ctx} />)}
    </Sheet>
  );
}

export function AskNew({ ctx }) {
  const [product, setProduct] = useState('');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const camRef = useRef(null);
  const galRef = useRef(null);
  async function add(files) {
    setBusy('photo'); setErr('');
    try { const u = []; for (const f of [...files].slice(0, 4)) u.push(await uploadPhoto(await shrink(f))); setPhotos((p) => [...p, ...u]); }
    catch (e) { setErr('העלאת התמונה נכשלה: ' + errText(e)); }
    setBusy('');
  }
  async function send() {
    if (!product.trim() && !photos.length) { setErr('צלם את המוצר או כתוב מה זה'); return; }
    setBusy('send'); setErr('');
    try {
      const a = await api.ask(ctx.shopId, { product: product.trim(), note: note.trim(), photos });
      ctx.applyAsk(a);
      serverCall('/api/notify', { shop: ctx.shopId, ask: a.id }).catch(() => {});
      ctx.toast('נשלח לכל העובדים ✓');
      ctx.close();
    } catch (e) { setErr(errText(e)); setBusy(''); }
  }
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head">
        <h2>💰 מה המחיר?</h2>
        <button className="btn primary sm" disabled={!!busy} onClick={send}>{busy === 'send' ? 'שולח…' : 'שליחה'}</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <div className="photos">
        {photos.map((x) => <div className="ph-edit" key={x}><img src={x} alt="" style={{ height: 110 }} /><button onClick={() => setPhotos(photos.filter((y) => y !== x))}>✕</button></div>)}
        <button className="btn primary" style={{ height: 110, width: 110, flex: 'none', flexDirection: 'column' }} disabled={busy === 'photo'} onClick={() => camRef.current?.click()}>
          {busy === 'photo' ? <span className="spin sm" /> : <><span style={{ fontSize: 30 }}>📷</span>צילום</>}
        </button>
        <button className="btn" style={{ height: 110, width: 80, flex: 'none', flexDirection: 'column' }} disabled={busy === 'photo'} onClick={() => galRef.current?.click()}><span style={{ fontSize: 24 }}>🖼️</span>גלריה</button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
        <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
      </div>
      <label className="lbl">מה המוצר?</label>
      <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="למשל: כיסוי ספר לסמסונג A55" />
      <label className="lbl">הערה (לא חובה)</label>
      <textarea className="input" rows={2} style={{ minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: הלקוח מחכה בחנות" />
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={!!busy} onClick={send}>{busy === 'send' ? 'שולח…' : '📣 שליחה לכל העובדים'}</button>
      <div className="muted small center" style={{ marginTop: 8 }}>כל העובדים יקבלו התראה. כשמישהו עונה — תקבל התראה עם המחיר.</div>
    </Sheet>
  );
}
