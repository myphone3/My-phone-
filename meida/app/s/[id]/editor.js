'use client';
import { useEffect, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import CoLogo from '@/components/CoLogo';
import { api, ai, errText, uploadPhoto } from '@/lib/api';
import { FIELDS, ALL_FIELDS, typeOf, imeiInfo, similarItems, norm, catOf, coOf } from '@/lib/kb';
import { generalCat } from './cat';

// ה-AI מציע חברות ונושאים בשמות — מתאימים לקטגוריה ולחברה שכבר קיימות (לא יוצרים חברות לבד)
export function pickSuggested(ctx, s) {
  const find = (list, names) => {
    for (const n of names || []) {
      const w = norm(n);
      const hit = list.find((t) => norm(t.name) === w) || list.find((t) => w.length >= 3 && (norm(t.name).includes(w) || w.includes(norm(t.name))));
      if (hit) return hit;
    }
    return null;
  };
  return { cat: find(ctx.categories, [...(s.topics || []), ...(s.categories || [])]), co: find(ctx.companies, s.companies) };
}
export const aiTags = (ctx) => [...ctx.categories.map((t) => ({ kind: 'topic', name: t.name })), ...ctx.companies.map((t) => ({ kind: 'company', name: t.name }))];
import { shrink, toAIImage } from '@/lib/image';

const blank = { type: 'note', title: '', body: '', fields: {}, tag_ids: [], photos: [], pinned: false };

// עריכה / הוספה. onDone = מצב טיוטה (ייבוא): מחזירים את הפריט במקום לשמור.
export default function Editor({ ctx, item, draft, auto, onDone }) {
  const [d, setD] = useState(() => ({ ...blank, ...(item || {}), ...(draft || {}), fields: { ...(item?.fields || {}), ...(draft?.fields || {}) },
    tag_ids: [...(draft?.tag_ids || item?.tag_ids || [])], type: draft?.type || item?.type || 'note' }));
  const [dupOk, setDupOk] = useState(false);
  const [allFields, setAllFields] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const setF = (k, v) => setD((x) => ({ ...x, fields: { ...x.fields, [k]: v } }));
  const t = typeOf(d.type, ctx.shop);
  const curCat = d.tag_ids.map((i) => ctx.tagsById[i]).find((x) => x?.kind === 'category') || (!item && !onDone ? null : null);
  const curCo = d.tag_ids.map((i) => ctx.tagsById[i]).find((x) => x?.kind === 'company');
  const setOne = (kind, tag) => setD((x) => ({ ...x, tag_ids: [...x.tag_ids.filter((i) => ctx.tagsById[i]?.kind !== kind), ...(tag ? [tag.id] : [])] }));
  const dups = similarItems(ctx.items, d.title, item?.id);
  const applyAI = (s) => {
    const { cat, co } = pickSuggested(ctx, s);
    setD((x) => {
      let ids = x.tag_ids;
      if (cat && !ids.some((i) => ctx.tagsById[i]?.kind === 'category')) ids = [...ids, cat.id];
      if (co && !ids.some((i) => ctx.tagsById[i]?.kind === 'company')) ids = [...ids, co.id];
      return { ...x, title: s.title || x.title, type: s.type || x.type, body: s.body || x.body, fields: { ...x.fields, ...s.fields }, tag_ids: ids };
    });
  };
  const shown = allFields ? ALL_FIELDS : [...new Set([...t.fields, ...ALL_FIELDS.filter((k) => d.fields[k])])];

  async function organize() {
    const text = [d.title, d.body, ...ALL_FIELDS.filter((k) => d.fields[k]).map((k) => `${FIELDS[k].label}: ${d.fields[k]}`)].filter(Boolean).join('\n');
    if (!text.trim()) { setErr('קודם כתוב או הדבק את המידע'); return; }
    setBusy('ai'); setErr('');
    try {
      const { item: s } = await ai({ mode: 'organize', shop: ctx.shopId, text, tags: aiTags(ctx) });
      applyAI(s);
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
        ai({ mode: 'image', shop: ctx.shopId, text: d.body, images: [{ mime: img.mime, data: img.data }], tags: aiTags(ctx) }),
      ]);
      applyAI(r.item);
      setD((x) => ({ ...x, photos: [...x.photos, url], source: x.source || 'photo' }));
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
    if (!onDone && dups.length && !dupOk) { setDupOk(true); setErr('⚠️ יש כבר מידע עם כותרת דומה (למעלה). בדוק שזה לא כפול, ולחץ שמירה שוב לאישור.'); document.getElementById('dupbox')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    let tag_ids = d.tag_ids;
    if (!tag_ids.some((i) => ctx.tagsById[i]?.kind === 'category') && generalCat(ctx)) tag_ids = [...tag_ids, generalCat(ctx).id];
    const out = { ...d, title, fields, tag_ids };
    if (onDone) { onDone({ ...out, fresh: [] }); ctx.close(); return; }
    setBusy('save'); setErr('');
    try {
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

      <label className="lbl">כותרת · לפיה מוצאים בחיפוש</label>
      <input className="input" value={d.title} onChange={(e) => { set('title', e.target.value); setDupOk(false); }} placeholder="למשל: העברת נתונים מאנדרואיד לאייפון" autoFocus={!item && !draft?.title && !draft?.body} />
      {dups.length > 0 && (
        <div className="dup" id="dupbox">
          ⚠️ <b>יש כבר מידע דומה</b> – לבדוק שזה לא כפול:
          {dups.map((x) => (
            <button key={x.id} type="button" className="card it" style={{ marginTop: 6 }} onClick={() => ctx.openItem(x)}>
              <div className="ic">{typeOf(x.type, ctx.shop).e}</div>
              <div className="grow"><div className="t">{x.title}</div><div className="s">{[coOf(x, ctx.tagsById)?.name, catOf(x, ctx.tagsById)?.name].filter(Boolean).join(' · ')}</div></div>
            </button>
          ))}
          <div className="muted small" style={{ marginTop: 6 }}>אם זה אותו דבר — עדיף לפתוח ולעדכן את הקיים. אם לא — ממשיכים כרגיל.</div>
        </div>
      )}

      <label className="lbl">קטגוריה</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {ctx.categories.map((c) => <button type="button" key={c.id} className={'chip' + (curCat?.id === c.id ? ' on' : '')} onClick={() => setOne('category', curCat?.id === c.id ? null : c)}>{c.emoji} {c.name}</button>)}
      </div>
      <label className="lbl">חברה (לא חובה)</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {ctx.companies.map((c) => <button type="button" key={c.id} className={'chip' + (curCo?.id === c.id ? ' on' : '')} onClick={() => setOne('company', curCo?.id === c.id ? null : c)}><CoLogo co={c} size={20} /> {c.name}</button>)}
        <button type="button" className="chip add" onClick={() => ctx.open({ t: 'settings', view: 'company' })}>+ חברה חדשה</button>
      </div>

      <label className="lbl">סוג</label>
      <div className="types">
        {ctx.types.map((x) => <button type="button" key={x.k} className={'type-btn' + (d.type === x.k ? ' on' : '')} onClick={() => set('type', x.k)}>{x.e} {x.label}</button>)}
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


      <label className="lbl">פרטים (אפשר להדביק מוואטסאפ — ו״סדר לי אוטומטית״ ממלא הכל)</label>
      <textarea className="input" rows={5} value={d.body} onChange={(e) => set('body', e.target.value)} placeholder="למשל: קוד לאיפוס סמסונג A54 — *#0*#  /  נקודת שירות של שיאומי בבני ברק, ז'בוטינסקי 50, 03-1234567" />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn soft grow" disabled={busy === 'ai'} onClick={organize}>
          {busy === 'ai' ? <><span className="spin sm" /> מסדר…</> : '✨ סדר לי אוטומטית'}
        </button>
        <button className="btn soft" disabled={busy === 'ai'} onClick={() => camRef.current?.click()}>📷 צלם וסדר</button>
        <input ref={camRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) fromPhoto(f); e.target.value = ''; }} />
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>מצלמים צילום מסך, כרטיס ביקור או מדבקה — והמערכת קוראת וממלאת לבד</div>

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
