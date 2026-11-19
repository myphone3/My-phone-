'use client';
import { useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText, uploadPhoto } from '@/lib/api';
import { shrink } from '@/lib/image';

export default function PostEditor({ ctx, post }) {
  const [p, setP] = useState(() => ({ kind: 'message', title: '', body: '', photos: [], urgent: false, pinned: false, ...(post || {}) }));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
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
    setBusy('save'); setErr('');
    try {
      const r = await api.savePost(ctx.shopId, { id: post?.id, kind: p.kind, title: p.title.trim(), body: p.body.trim(), photos: p.photos, due: p.due || '',
        remind_at: p.remind_at || '', remind_to: p.remind_to || 'all', pinned: p.pinned, urgent: p.urgent });
      ctx.applyPost(r);
      if (!post) ctx.notify({ post: r.id });
      ctx.toast(post ? 'נשמר' : r.urgent ? '🚨 נשלח כדחוף לכל הצוות' : 'נשלח לכל הצוות ✓');
      ctx.close();
    } catch (e) { setErr(errText(e)); setBusy(''); }
  }

  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head">
        <h2>{post ? 'עריכת הודעה' : 'הודעה חדשה'}</h2>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <label className="lbl" style={{ marginTop: 0 }}>מה לכתוב לצוות?</label>
      <textarea className="input" rows={4} value={p.body} onChange={(e) => set('body', e.target.value)} placeholder="למשל: יצאתי, חוזר בעוד שעה" autoFocus={!post} />
      {post?.title && <>
        <label className="lbl">כותרת</label>
        <input className="input" value={p.title} onChange={(e) => set('title', e.target.value)} />
      </>}
      <button className={'choice block' + (p.urgent ? ' on urgent-on' : '')} style={{ marginTop: 10 }} onClick={() => set('urgent', !p.urgent)}>
        🚨 דחוף — ההתראה חוזרת עד שמישהו לוחץ "ראיתי"
      </button>
      <label className="lbl">תמונות</label>
      <div className="photos">
        {p.photos.map((x) => <div className="ph-edit" key={x}><img src={x} alt="" style={{ height: 80 }} /><button onClick={() => set('photos', p.photos.filter((y) => y !== x))}>✕</button></div>)}
        <button className="btn" style={{ height: 80, width: 80, flex: 'none' }} onClick={() => fileRef.current?.click()} disabled={busy === 'photo'}>{busy === 'photo' ? <span className="spin sm" /> : '📷'}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); e.target.value = ''; }} />
      </div>
      <button className="toggle card" style={{ width: '100%', marginTop: 12 }} onClick={() => set('pinned', !p.pinned)}>
        <span className={'check' + (p.pinned ? ' on' : '')}>{p.pinned ? '✓' : ''}</span><span>📌 נעיצה בראש ההודעות</span>
      </button>
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={!!busy} onClick={save}>{busy === 'save' ? 'שולח…' : post ? 'שמירה' : p.urgent ? '🚨 שליחה כדחוף לכל הצוות' : 'שליחה לכל הצוות'}</button>
    </Sheet>
  );
}
