'use client';
import { useEffect, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import TagPicker from '@/components/TagPicker';
import { api, ai, errText, uploadPhoto } from '@/lib/api';
import { TYPES, FIELDS, ALL_FIELDS, typeOf, imeiInfo } from '@/lib/kb';
import { resolveSuggested } from '@/lib/tags';
import { shrink, toAIImage } from '@/lib/image';

const blank = { type: 'note', title: '', body: '', fields: {}, tag_ids: [], photos: [], pinned: false };

// עריכה / הוספה. onDone = מצב טיוטה (ייבוא): מחזירים את הפריט במקום לשמור.
export default function Editor({ ctx, item, draft, auto, onDone }) {
  const [d, setD] = useState(() => ({ ...blank, ...(item || {}), ...(draft || {}), fields: { ...(item?.fields || {}), ...(draft?.fields || {}) },
    tag_ids: [...(draft?.tag_ids || item?.tag_ids || [])], type: draft?.type || item?.type || 'note' }));
  const [fresh, setFresh] = useState(draft?.fresh || []);
  const [allFields, setAllFields] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setF = (k, v) => setD((x) => ({ ...x, fields: { ...x.fields, [k]: v } }));
  const t = typeOf(d.type);
  const shown = allFields ? ALL_FIELDS : [...new Set([...t.fields, ...ALL_FIELDS.filter((k) => d.fields[k])])];

  async function organize() {
    const text = [d.title, d.body, ...ALL_FIELDS.filter((k) => d.fields[k]).map((k) => `${FIELDS[k].label}: ${d.fields[k]}`)].filter(Boolean).join('\n');
    if (!text.trim()) { setErr('קודם כתוב או הדבק את המידע'); return; }
    setBusy('ai'); setErr('');
    try {
      const { item: s } = await ai({ mode: 'organize', shop: ctx.shopId, text, tags: ctx.tags.map((x) => ({ kind: x.kind, name: x.name })) });
      const { ids, fresh: nf } = resolveSuggested(ctx.tags, s);
      setD((x) => ({ ...x, title: s.title || x.title, type: s.type || x.type, body: s.body || x.body,
        fields: { ...x.fields, ...s.fields }, tag_ids: [...new Set([...x.tag_ids, ...ids])] }));
      setFresh((f) => [...f, ...nf.filter((n) => !f.some((o) => o.kind === n.kind && o.name === n.name))]);
    } catch (e) { setErr(errText(e)); }
    setBusy('');
  }
  useEffect(() => { if (auto) organize(); }, []); // eslint-disable-line

  // צילום ← ה-AI קורא את התמונה וממלא הכל (והתמונה נשמרת בפריט)
  async function fromPhoto(file) {
    setBusy('ai'); setErr('');
    try {
      const img = await toAIImage(file);
      const [url, r] = await Promise.all([
        uploadPhoto(await shrink(file)),
        ai({ mode: 'image', shop: ctx.shopId, text: d.body, images: [{ mime: img.mime, data: img.data }], tags: ctx.tags.map((x) => ({ kind: x.kind, name: x.name })) }),
      ]);
      const s = r.item;
      const { ids, fresh: nf } = resolveSuggested(ctx.tags, s);
      setD((x) => ({ ...x, title: s.title || x.title, type: s.type || x.type, body: s.body || x.body, fields: { ...x.fields, ...s.fields },
        tag_ids: [...new Set([...x.tag_ids, ...ids])], photos: [...x.photos, url], source: x.source || 'photo' }));
      setFresh((f) => [...f, ...nf.filter((n) => !f.some((o) => o.kind === n.kind && o.name === n.name))]);
    } catch (e) { setErr(errText(e)); }
    setBusy('');
  }

  async function addPhotos(files) {
    setBusy('photo'); setErr('');
    try {
      const urls = [];
      for (const f of [...files].slice(0, 6)) urls.push(await uploadPhoto(await shrink(f)));
      setD((x) => ({ ...x, photos: [...x.photos, ...urls] }));
    } catch (e) { setErr('העלאת התמונה נכשלה: ' + errText(e)); }
    setBusy('');
  }

  async function save() {
    const fields = Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, String(v || '').trim()]).filter(([, v]) => v));
    if (fields.imei) { const i = imeiInfo(fields.imei); if (i) fields.imei = i.imei; }
    let title = d.title.trim();
    if (!title) title = (d.body.trim().split('\n')[0] || fields[t.fields[0]] || '').slice(0, 80);
    if (!title && !d.body.trim()) { setErr('אין מה לשמור — כתוב משהו'); return; }
    const out = { ...d, title, fields };
    if (onDone) { onDone({ ...out, fresh }); ctx.close(); return; }
    setBusy('save'); setErr('');
    try {
      const tag_ids = await ctx.ensureTags(d.tag_ids, fresh);
      const r = await api.saveItem(ctx.shopId, { id: item?.id, type: out.type, title, body: out.body, fields, tag_ids, photos: out.photos, pinned: out.pinned, source: item ? item.source : d.source || draft?.source });
      ctx.applyItem(r);
      ctx.toast('נשמר ✓');
      if (item) ctx.close(); else ctx.replace({ t: 'item', id: r.id });
    } catch (e) { setErr(errText(e)); setBusy(''); }
  }

  return (
    <Sheet onClose={() => { if (!busy || busy === 'ai') ctx.close(); }}>
      <div className="sheet-head">
        <h2>{item ? 'עריכה' : onDone ? 'עריכת פריט לייבוא' : 'מידע חדש'}</h2>
        <button className="btn primary sm" disabled={!!busy && busy !== 'ai'} onClick={save}>{busy === 'save' ? 'שומר…' : 'שמירה'}</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>

      <label className="lbl">מה רוצים לשמור? (אפשר להדביק מוואטסאפ)</label>
      <textarea className="input" rows={5} value={d.body} onChange={(e) => set('body', e.target.value)} placeholder="למשל: קוד לאיפוס סמסונג A54 — *#0*#  /  נקודת שירות של שיאומי בבני ברק, ז'בוטינסקי 50, 03-1234567" autoFocus={!item && !draft?.body && !auto} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn soft grow" disabled={busy === 'ai'} onClick={organize}>
          {busy === 'ai' ? <><span className="spin sm" /> מסדר…</> : '✨ סדר לי אוטומטית'}
        </button>
        <button className="btn soft" disabled={busy === 'ai'} onClick={() => camRef.current?.click()}>📷 צלם וסדר</button>
        <input ref={camRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) fromPhoto(f); e.target.value = ''; }} />
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>מצלמים צילום מסך, כרטיס ביקור או מדבקה — והמערכת קוראת וממלאת לבד</div>

      <label className="lbl">כותרת</label>
      <input className="input" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="כותרת קצרה — לפיה מחפשים" />

      <label className="lbl">סוג</label>
      <div className="types">
        {TYPES.map((x) => <button type="button" key={x.k} className={'type-btn' + (d.type === x.k ? ' on' : '')} onClick={() => set('type', x.k)}>{x.e} {x.label}</button>)}
      </div>

      {shown.map((k) => (
        <div key={k}>
          <label className="lbl">{FIELDS[k].label}</label>
          <input className={'input' + (FIELDS[k].mono ? ' mono' : '')} value={d.fields[k] || ''} inputMode={FIELDS[k].inputMode}
            dir={FIELDS[k].mono || FIELDS[k].tel || FIELDS[k].url ? 'ltr' : undefined} onChange={(e) => setF(k, e.target.value)} />
          {k === 'imei' && <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={() => ctx.open({ t: 'scan', onPick: (n, model) => { setF('imei', n); if (model && !d.fields.model) setF('model', model); } })}>📷 סריקת IMEI</button>}
          {k === 'imei' && d.fields.imei && (() => { const i = imeiInfo(d.fields.imei); return i ? <div className={'small ' + (i.ok ? '' : 'err')} style={{ marginTop: 3 }}>{i.fixed ? `המלא: ${i.imei}` : i.ok ? '✓ תקין' : '✗ ספרת ביקורת לא מתאימה'}</div> : null; })()}
        </div>
      ))}
      {!allFields && <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => setAllFields(true)}>+ שדות נוספים (טלפון, כתובת, קוד…)</button>}

      <TagPicker tags={ctx.tags} ids={d.tag_ids} fresh={fresh} onChange={(ids, f) => { set('tag_ids', ids); setFresh(f); }} />

      <label className="lbl">תמונות (צילום מסך, כרטיס ביקור…)</label>
      <div className="photos">
        {d.photos.map((p) => (
          <div className="ph-edit" key={p}><img src={p} alt="" style={{ height: 90 }} /><button type="button" onClick={() => set('photos', d.photos.filter((x) => x !== p))}>✕</button></div>
        ))}
        <button type="button" className="btn" style={{ height: 90, width: 90, flex: 'none' }} onClick={() => fileRef.current?.click()} disabled={busy === 'photo'}>
          {busy === 'photo' ? <span className="spin sm" /> : '📷 הוספה'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) addPhotos(e.target.files); e.target.value = ''; }} />
      </div>

      <button type="button" className="toggle card" style={{ width: '100%', marginTop: 12 }} onClick={() => set('pinned', !d.pinned)}>
        <span className={'check' + (d.pinned ? ' on' : '')}>{d.pinned ? '✓' : ''}</span>
        <span>📌 נעיצה בראש המסך (מידע שצריך כל יום)</span>
      </button>

      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={!!busy && busy !== 'ai'} onClick={save}>{busy === 'save' ? 'שומר…' : onDone ? 'אישור' : 'שמירה'}</button>
    </Sheet>
  );
}
