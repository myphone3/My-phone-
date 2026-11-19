'use client';
import { useMemo, useState } from 'react';
import Page from '@/components/Page';
import CoLogo from '@/components/CoLogo';
import ItemRow from '@/components/ItemRow';
import { RichText } from './item';
import { typeOf, FIELDS, ALL_FIELDS, catOf, coOf, norm, telHref, wazeHref, copyText, itemToText, queryWords, score } from '@/lib/kb';

export const generalCat = (ctx) => ctx.categories.find((c) => c.name === 'מידע כללי') || ctx.categories[0];
// פריטים של קטגוריה. פריט בלי קטגוריה נחשב "מידע כללי".
export function itemsInCat(ctx, cat) {
  const g = generalCat(ctx);
  return ctx.items.filter((it) => { const c = catOf(it, ctx.tagsById); return c ? c.id === cat.id : g && g.id === cat.id; });
}
const HL = ['warranty', 'compare'];

// כרטיס מידע מלא (בדף חברה): כל השדות עם כפתורים
export function InfoCard({ it, ctx, hl }) {
  const t = typeOf(it.type, ctx.shop);
  const f = it.fields || {};
  const full = f.address && f.city && !f.address.includes(f.city) ? `${f.address}, ${f.city}` : f.address;
  const facts = ['pc', 'mobile', 'cost'].filter((k) => f[k]);
  const yn = (v) => <span className={/^לא/.test(String(v).trim()) ? 'no' : 'yes'}>{v}</span>;
  async function share() {
    const text = itemToText(it, ctx.tagsById);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }
  return (
    <div className={'card info' + (hl ? ' hl' : '')}>
      <div className="ttl" onClick={() => ctx.openItem(it)}><span>{t.e}</span><span className="grow">{it.title || t.label}</span><span className="muted">‹</span></div>
      {facts.length > 0 && <div className="facts">{facts.map((k) => <div key={k} className="fact"><div className="k">{FIELDS[k].label}</div><div className="v">{k === 'cost' ? f[k] : yn(f[k])}</div></div>)}</div>}
      {f.code && <button className="code" onClick={() => copyText(f.code).then(() => ctx.toast('הועתק'))}>{f.code}</button>}
      {ALL_FIELDS.filter((k) => f[k] && !['code', 'pc', 'mobile', 'cost'].includes(k)).map((k) => (
        <div key={k} className="ln"><span className="k">{FIELDS[k].label}</span><span className={'v' + (FIELDS[k].tel || FIELDS[k].mono ? ' ltr' : '')}>{f[k]}</span></div>
      ))}
      {it.body && <RichText text={it.body} ctx={ctx} />}
      {it.photos?.length > 0 && <div className="photos">{it.photos.map((p) => <img key={p} src={p} alt="" onClick={() => ctx.openItem(it)} />)}</div>}
      <div className="row wrap-row">
        {f.address && <a className="btn sm" href={wazeHref(full)} target="_blank" rel="noreferrer">🚗 Waze</a>}
        {(f.phone || f.phone2) && <a className="btn sm" href={telHref(f.phone || f.phone2)}>📞 חיוג</a>}
        {it.type === 'service' ? <button className="btn sm" onClick={() => ctx.open({ t: 'cust', id: it.id })}>📤 ללקוח</button>
          : <button className="btn sm" onClick={share}>💬 שליחה</button>}
        <button className="btn sm" onClick={() => ctx.open({ t: 'edit', item: it })}>✏️</button>
      </div>
    </div>
  );
}

export function CategoryPage({ ctx, catId }) {
  const cat = ctx.tagsById[catId];
  const [q, setQ] = useState('');
  const all = useMemo(() => (cat ? itemsInCat(ctx, cat) : []), [cat, ctx.items, ctx.tagsById]); // eslint-disable-line
  if (!cat || cat.deleted_at) return <Page onBack={ctx.close} title="הקטגוריה נמחקה"><div className="empty">🗑️</div></Page>;
  const words = queryWords(q);
  const list = words.length ? all.filter((it) => score(ctx.index.get(it.id), words, q.replace(/\D/g, ''))) : all;
  const byCo = {};
  const general = [];
  for (const it of list) { const c = coOf(it, ctx.tagsById); if (c) (byCo[c.id] ||= []).push(it); else general.push(it); }
  const cos = ctx.companies.filter((c) => byCo[c.id]);
  const summary = (l) => { const sp = l.filter((x) => x.type === 'service').length; return sp ? (sp === 1 ? 'נקודת שירות אחת' : `${sp} נקודות שירות`) : l.length === 1 ? 'פריט אחד' : `${l.length} פריטים`; };
  general.sort((a, b) => (b.pinned - a.pinned) || (a.title || '').localeCompare(b.title || '', 'he'));

  return (
    <Page onBack={ctx.close} title={`${cat.emoji || '🗂️'} ${cat.name}`}>
      <div className="search">
        <span>🔎</span>
        <input className="input" type="search" placeholder={`חיפוש בתוך ${cat.name}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button onClick={() => setQ('')} aria-label="נקה">✕</button>}
      </div>
      {!all.length && <div className="empty"><div className="e">{cat.emoji || '🗂️'}</div>עוד אין כאן מידע</div>}
      {cos.length > 0 && <>
        <div className="h2">לפי חברה</div>
        <div className="cos">{cos.map((c) => (
          <button key={c.id} className="co" onClick={() => ctx.open({ t: 'co', id: c.id, cat: cat.id })}><CoLogo co={c} /><b>{c.name}</b><span className="n">{summary(byCo[c.id])}</span></button>
        ))}</div>
      </>}
      {general.length > 0 && <>
        <div className="h2">{cos.length ? 'כללי' : 'הכל'} ({general.length})</div>
        {general.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} words={words} hideCat />)}
      </>}
      {words.length > 0 && all.length > 0 && !list.length && <div className="empty">לא נמצא "{q}" בקטגוריה הזו</div>}
      <button className="btn dashed block" style={{ marginTop: 14 }} onClick={() => ctx.open({ t: 'edit', draft: { tag_ids: [cat.id] } })}>➕ הוספה ל{cat.name}</button>
    </Page>
  );
}

export function CompanyPage({ ctx, coId, catId }) {
  const co = ctx.tagsById[coId];
  const cat = catId ? ctx.tagsById[catId] : null;
  if (!co || co.deleted_at) return <Page onBack={ctx.close} title="החברה נמחקה"><div className="empty">🗑️</div></Page>;
  const mine = ctx.items.filter((it) => coOf(it, ctx.tagsById)?.id === co.id);
  const here = cat ? mine.filter((it) => (catOf(it, ctx.tagsById)?.id || generalCat(ctx)?.id) === cat.id) : mine;
  const other = cat ? mine.filter((it) => !here.includes(it)) : [];
  const hl = here.filter((x) => HL.includes(x.type));
  const points = here.filter((x) => x.type === 'service').sort((a, b) => (a.title || '').localeCompare(b.title || '', 'he'));
  const rest = here.filter((x) => !hl.includes(x) && !points.includes(x));
  const stock = ctx.stock.filter((x) => x.company_id === co.id && x.status !== 'arrived');
  return (
    <Page onBack={ctx.close} sub={cat ? cat.name : 'כל המידע'} title={<span className="row" style={{ gap: 8 }}><CoLogo co={co} size={30} />{co.name}</span>}>
      <div className="list">
        {hl.map((it) => <InfoCard key={it.id} it={it} ctx={ctx} hl />)}
        {points.length > 0 && <><div className="h2" style={{ marginBottom: 0 }}>📍 נקודות שירות ({points.length})</div>{points.map((it) => <InfoCard key={it.id} it={it} ctx={ctx} />)}</>}
        {rest.length > 0 && <>{(hl.length > 0 || points.length > 0) && <div className="h2" style={{ marginBottom: 0 }}>עוד</div>}{rest.map((it) => <InfoCard key={it.id} it={it} ctx={ctx} />)}</>}
        {!here.length && <div className="empty">אין עדיין מידע על {co.name}{cat ? ` ב${cat.name}` : ''}</div>}
        <button className="btn dashed block" onClick={() => ctx.open({ t: 'edit', draft: { tag_ids: [cat?.id, co.id].filter(Boolean), type: cat && /אחריות|תיקונ/.test(cat.name) ? 'service' : undefined } })}>➕ הוספת מידע ל{co.name}</button>
      </div>
      {stock.length > 0 && <><div className="h2">📦 חסר במלאי מ{co.name}</div>{stock.map((x) => <div key={x.id} className="card it" onClick={() => { ctx.close(); ctx.setTab('stock'); }}><div className="ic">📦</div><div className="grow"><div className="t">{x.name}</div></div></div>)}</>}
      {other.length > 0 && <><div className="h2">עוד על {co.name}</div>{other.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} />)}</>}
    </Page>
  );
}

export { norm };
