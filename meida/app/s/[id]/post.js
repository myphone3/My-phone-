'use client';
import { useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText, uploadPhoto, serverCall } from '@/lib/api';
import { shrink } from '@/lib/image';
import { POST_KINDS } from './board';

// datetime-local ↔ ISO
const toLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocal = (v) => (v ? new Date(v).toISOString() : '');
function preset(kind) {
  const d = new Date();
  if (kind === 'hour') d.setHours(d.getHours() + 1, d.getMinutes(), 0, 0);
  if (kind === 'eve') { d.setHours(18, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); }
  if (kind === 'tom') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
  if (kind === 'week') { d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); }
  return d.toISOString();
}

export default function PostEditor({ ctx, post, kind }) {
  const [p, setP] = useState(() => ({ kind: kind || 'message', title: '', body: '', photos: [], due: '', remind_at: '', remind_to: 'all', pinned: false, ...(post || {}) }));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [showRemind, setShowRemind] = useState(!!post?.remind_at || kind === 'reminder');
  const fileRef = useRef(null);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));

  async function addPhotos(files) {
    setBusy('photo');
    try { const urls = []; for (const f of [...files].slice(0, 4)) urls.push(await uploadPhoto(await shrink(f))); set('photos', [...p.photos, ...urls]); }
    catch (e) { setErr(errText(e)); }
    setBusy('');
  }
  async function save() {
    if (!p.title.trim() && !p.body.trim()) { setErr('כתוב משהו'); return; }
    if (p.kind === 'reminder' && !p.remind_at) { setErr('בחר מתי להזכיר'); return; }
    setBusy('save'); setErr('');
    try {
      const r = await api.savePost(ctx.shopId, { id: post?.id, kind: p.kind, title: p.title.trim(), body: p.body.trim(), photos: p.photos, due: p.due || '',
        remind_at: showRemind ? p.remind_at || '' : '', remind_to: p.remind_to, pinned: p.pinned });
      ctx.applyPost(r);
      if (!post) serverCall('/api/notify', { shop: ctx.shopId, post: r.id }).catch(() => {});
      ctx.toast(post ? 'נשמר' : r.remind_to === 'me' ? 'נשמר ✓' : 'נשלח לכולם ✓');
      ctx.close();
    } catch (e) { setErr(errText(e)); setBusy(''); }
  }

  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head">
        <h2>{post ? 'עריכת הודעה' : 'הודעה חדשה'}</h2>
        <button className="btn primary sm" disabled={!!busy} onClick={save}>{busy === 'save' ? 'שולח…' : post ? 'שמירה' : 'שליחה'}</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {POST_KINDS.map((k) => <button key={k.k} className={'chip' + (p.kind === k.k ? ' on' : '')} onClick={() => { set('kind', k.k); if (k.k === 'reminder') setShowRemind(true); }}>{k.e} {k.label}</button>)}
      </div>
      <label className="lbl">כותרת</label>
      <input className="input" value={p.title} onChange={(e) => set('title', e.target.value)}
        placeholder={{ promo: 'למשל: מבצע הוט מובייל — 2 קווים ב-50 ₪', stock: 'למשל: חסר מטען USB-C מקורי לסמסונג', task: 'למשל: להחזיר מכשיר ללקוח (כהן)', reminder: 'למשל: לשלוח הזמנה לספק', message: 'במה מדובר?' }[p.kind]} autoFocus={!post} />
      <label className="lbl">פרטים</label>
      <textarea className="input" rows={4} value={p.body} onChange={(e) => set('body', e.target.value)} placeholder="אפשר להדביק מוואטסאפ" />

      <div className="row wrap-row" style={{ marginTop: 10 }}>
        <div className="grow" style={{ minWidth: 150 }}>
          <label className="lbl" style={{ marginTop: 0 }}>{p.kind === 'promo' ? 'המבצע בתוקף עד' : p.kind === 'task' ? 'לבצע עד' : 'רלוונטי עד (לא חובה)'}</label>
          <input className="input" type="date" value={p.due || ''} onChange={(e) => set('due', e.target.value)} />
        </div>
      </div>

      {!showRemind ? (
        <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setShowRemind(true)}>⏰ להוסיף תזכורת</button>
      ) : (
        <div className="card pad" style={{ marginTop: 10 }}>
          <div className="row"><b className="grow">⏰ תזכורת (התראה לטלפון)</b>{p.kind !== 'reminder' && <button className="btn sm" onClick={() => { setShowRemind(false); set('remind_at', ''); }}>בלי תזכורת</button>}</div>
          <div className="chips">
            {[['hour', 'בעוד שעה'], ['eve', 'היום ב-18:00'], ['tom', 'מחר ב-9:00'], ['week', 'בעוד שבוע']].map(([k, l]) => <button key={k} className="chip" onClick={() => set('remind_at', preset(k))}>{l}</button>)}
          </div>
          <input className="input" type="datetime-local" style={{ marginTop: 6 }} value={toLocal(p.remind_at)} onChange={(e) => set('remind_at', fromLocal(e.target.value))} />
          <div className="tabs">
            <button className={'tab' + (p.remind_to === 'all' ? ' on' : '')} onClick={() => set('remind_to', 'all')}>👥 לכל העובדים</button>
            <button className={'tab' + (p.remind_to === 'me' ? ' on' : '')} onClick={() => set('remind_to', 'me')}>🙋 רק לי</button>
          </div>
          {p.remind_to === 'me' && <div className="muted small" style={{ marginTop: 6 }}>"רק לי" — ההודעה לא תופיע לשאר העובדים.</div>}
        </div>
      )}

      <label className="lbl">תמונות</label>
      <div className="photos">
        {p.photos.map((x) => <div className="ph-edit" key={x}><img src={x} alt="" style={{ height: 80 }} /><button onClick={() => set('photos', p.photos.filter((y) => y !== x))}>✕</button></div>)}
        <button className="btn" style={{ height: 80, width: 80, flex: 'none' }} onClick={() => fileRef.current?.click()} disabled={busy === 'photo'}>{busy === 'photo' ? <span className="spin sm" /> : '📷'}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); e.target.value = ''; }} />
      </div>
      <button className="toggle card" style={{ width: '100%', marginTop: 12 }} onClick={() => set('pinned', !p.pinned)}>
        <span className={'check' + (p.pinned ? ' on' : '')}>{p.pinned ? '✓' : ''}</span><span>📌 נעיצה בראש הלוח</span>
      </button>
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={!!busy} onClick={save}>{busy === 'save' ? 'שולח…' : post ? 'שמירה' : p.remind_to === 'me' && showRemind ? 'שמירת תזכורת' : '📣 שליחה לכל העובדים'}</button>
    </Sheet>
  );
}
