'use client';
import { useEffect, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText } from '@/lib/api';
import { typeOf, FIELDS, ALL_FIELDS, tokens, telHref, wazeHref, mapsHref, urlHref, timeAgo, itemToText, copyText, luhnOk } from '@/lib/kb';

export function RichText({ text, ctx }) {
  return (
    <div className="body-text">
      {tokens(text).map((p, i) => {
        if (p.t === 'url') return <a key={i} href={urlHref(p.v)} target="_blank" rel="noreferrer" className="ltr">{p.v}</a>;
        if (p.t === 'tel') return <a key={i} href={telHref(p.v)} className="ltr">{p.v}</a>;
        if (p.t === 'num') return <a key={i} href="#" className="mono" onClick={(e) => { e.preventDefault(); copyText(p.v).then(() => ctx.toast('הועתק: ' + p.v)); }}>{p.v}</a>;
        return <span key={i}>{p.v}</span>;
      })}
    </div>
  );
}

function Field({ k, v, ctx, it }) {
  const f = FIELDS[k];
  const copy = () => copyText(v).then(() => ctx.toast('הועתק'));
  const full = k === 'address' && it.fields?.city && !v.includes(it.fields.city) ? `${v}, ${it.fields.city}` : v;
  return (
    <div className="field">
      <div className="grow" onClick={f.copy ? copy : undefined}>
        <div className="k">{f.label}{k === 'imei' && /^\d{15}$/.test(v) && (luhnOk(v) ? ' ✓' : ' ⚠️ לא תקין')}</div>
        <div className={'v' + (f.mono ? ' mono' : '') + (f.tel || f.url ? ' ltr' : '')} style={{ textAlign: 'start' }}>{v}</div>
      </div>
      {f.tel && <a className="btn sm primary" href={telHref(v)}>📞 חיוג</a>}
      {f.map && <><a className="btn sm" href={wazeHref(full)} target="_blank" rel="noreferrer">Waze</a><a className="btn sm" href={mapsHref(full)} target="_blank" rel="noreferrer">מפה</a></>}
      {f.url && <a className="btn sm primary" href={urlHref(v)} target="_blank" rel="noreferrer">פתיחה ↗</a>}
      <button className="btn sm" onClick={copy}>העתק</button>
    </div>
  );
}

function History({ ctx, it, onClose }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState(null);
  useEffect(() => { api.history(ctx.shopId, it.id).then(setList).catch((e) => setErr(errText(e))); }, [ctx.shopId, it.id]);
  const ACT = { create: 'יצר/ה', edit: 'ערך/ה', delete: 'מחק/ה', restore: 'שחזר/ה' };
  async function restore(s) {
    try {
      const r = await api.saveItem(ctx.shopId, { id: it.id, type: s.type, title: s.title, body: s.body, fields: s.fields, tag_ids: s.tag_ids, photos: s.photos, pinned: s.pinned });
      ctx.applyItem(r); ctx.toast('הגרסה שוחזרה'); onClose();
    } catch (e) { setErr(errText(e)); }
  }
  return (
    <div className="card pad" style={{ marginTop: 12 }}>
      <div className="row"><b className="grow">היסטוריית שינויים</b><button className="btn sm" onClick={onClose}>סגירה</button></div>
      {err && <div className="err">{err}</div>}
      {list === null && !err && <div className="spin sm" style={{ margin: 10 }} />}
      {list?.map((h, i) => (
        <div key={h.id} className="hist" style={{ marginTop: 8 }}>
          <div className="row">
            <div className="grow small"><b>{h.by_name}</b> {ACT[h.action] || h.action} · {timeAgo(h.at)}</div>
            <button className="btn sm" onClick={() => setView(view === h.id ? null : h.id)}>{view === h.id ? 'הסתר' : 'הצג'}</button>
          </div>
          {view === h.id && (
            <div style={{ marginTop: 6 }}>
              <b>{h.snapshot.title}</b>
              {ALL_FIELDS.filter((k) => h.snapshot.fields?.[k]).map((k) => <div key={k} className="small">{FIELDS[k].label}: {h.snapshot.fields[k]}</div>)}
              <div className="body-text small">{h.snapshot.body}</div>
              {i > 0 && h.action !== 'delete' && <button className="btn sm soft" style={{ marginTop: 6 }} onClick={() => restore(h.snapshot)}>↩ החזר לגרסה הזו</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const fmtFull = (s) => new Date(s).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function ItemView({ ctx, id }) {
  const it = ctx.items.find((x) => x.id === id);
  const [hist, setHist] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!it) return (
    <Sheet onClose={ctx.close}><div className="empty"><div className="e">🗑️</div>הפריט נמחק</div></Sheet>
  );
  const t = typeOf(it.type);
  const tags = (it.tag_ids || []).map((x) => ctx.tagsById[x]).filter(Boolean);

  async function pin() {
    try { await api.pin(ctx.shopId, it.id, !it.pinned); ctx.applyItem({ ...it, pinned: !it.pinned }); ctx.toast(it.pinned ? 'הוסר מהנעוצים' : 'ננעץ בראש המסך'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  async function del() {
    if (!confirm('למחוק את הפריט? (אפשר לשחזר מ"פריטים שנמחקו")')) return;
    setBusy(true);
    try { await api.deleteItem(ctx.shopId, it.id); ctx.removeItem(it.id); ctx.toast('נמחק'); ctx.close(); }
    catch (e) { ctx.toast(errText(e)); setBusy(false); }
  }
  async function share() {
    const text = itemToText(it, ctx.tagsById);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head">
        <h2>{t.e} {it.title || t.label}</h2>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        <span className="chip">{t.e} {t.label}</span>
        {tags.map((x) => <span key={x.id} className={'chip k-' + x.kind}>{x.emoji && x.kind === 'topic' ? x.emoji + ' ' : ''}{x.name}</span>)}
      </div>
      <div style={{ marginTop: 10 }}>
        {ALL_FIELDS.filter((k) => it.fields?.[k]).map((k) => <Field key={k} k={k} v={String(it.fields[k])} ctx={ctx} it={it} />)}
      </div>
      {it.body && <div style={{ marginTop: 10 }}><RichText text={it.body} ctx={ctx} /></div>}
      {it.photos?.length > 0 && <div className="photos" style={{ marginTop: 10 }}>{it.photos.map((p) => <img key={p} src={p} alt="" onClick={() => setPhoto(p)} />)}</div>}
      <div className="row wrap-row" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={() => ctx.open({ t: 'edit', item: it })}>✏️ עריכה</button>
        <button className="btn" onClick={() => copyText(itemToText(it, ctx.tagsById)).then(() => ctx.toast('הכל הועתק'))}>📋 העתק</button>
        <button className="btn" onClick={share}>📤 שליחה</button>
        <button className="btn" onClick={pin}>{it.pinned ? '📌 ביטול נעיצה' : '📌 נעיצה'}</button>
      </div>
      <div className="details">
        <div><span>👤 נוסף ע״י</span><b>{it.created_by_name || '—'}</b></div>
        <div><span>📅 נוסף ב</span><span>{fmtFull(it.created_at)}</span></div>
        {it.updated_at !== it.created_at && it.updated_by_name && <>
          <div><span>✏️ עודכן ע״י</span><b>{it.updated_by_name}</b></div>
          <div><span>🕘 עודכן ב</span><span>{fmtFull(it.updated_at)}</span></div>
        </>}
        <div><span>📥 מקור</span><span>{it.source === 'whatsapp' ? 'ייבוא מוואטסאפ' : it.source === 'photo' ? 'צילום' : it.source === 'share' ? 'שיתוף מוואטסאפ' : 'הוקלד באפליקציה'}</span></div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm" onClick={() => setHist((h) => !h)}>🕘 היסטוריית שינויים</button>
        {ctx.isAdmin && <button className="btn sm danger" disabled={busy} onClick={del}>🗑️ מחיקה</button>}
      </div>
      {hist && <History ctx={ctx} it={it} onClose={() => setHist(false)} />}
      {photo && (
        <div className="sheet-bg" style={{ alignItems: 'center', zIndex: 80 }} onClick={() => setPhoto(null)}>
          <img src={photo} alt="" style={{ maxWidth: '100%', maxHeight: '92vh' }} />
        </div>
      )}
    </Sheet>
  );
}
