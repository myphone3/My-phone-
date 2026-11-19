'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import CoLogo from '@/components/CoLogo';
import InstallButton from '@/components/InstallButton';
import PushToggle from '@/components/PushToggle';
import Bonus from './bonus';
import { api, errText, uploadPhoto } from '@/lib/api';
import { shrink } from '@/lib/image';
import { signOut, userName } from '@/lib/auth';
import { setLastShop, clearCached } from '@/lib/cache';
import { TYPES, STOCK_ST, typeOf, stockSt, timeAgo, FIELDS, ALL_FIELDS, catOf, coOf, norm, ils, guessDomain, cleanDomain } from '@/lib/kb';

const Back = ({ onClick }) => <button className="btn sm" onClick={onClick}>→ חזרה</button>;

// קטגוריות / חברות: הוספה, שינוי שם, אימוג'י או לוגו, סדר, מחיקה
function TagList({ ctx, kind, back }) {
  const isCo = kind === 'company';
  const list = isCo ? ctx.companies : ctx.categories;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(isCo ? '' : '🗂️');
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [site, setSite] = useState('');
  const [domFor, setDomFor] = useState(null);
  const fileRef = useRef(null);
  const logoFor = useRef(null);
  const counts = useMemo(() => { const c = {}; for (const it of ctx.items) for (const t of it.tag_ids || []) c[t] = (c[t] || 0) + 1; return c; }, [ctx.items]);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setErr('');
    try {
      const t = await api.saveTag(ctx.shopId, { kind, name: name.trim(), emoji: isCo ? '' : emoji });
      ctx.applyTags([t]); setName(''); ctx.toast('נוסף ✓');
      const d = isCo && !t.logo_url && (cleanDomain(site) || guessDomain(t.name));
      setSite('');
      if (d) autoLogo(t, d, true);
    } catch (er) { setErr(errText(er)); }
  }
  // לוגו אוטומטי מהאתר של החברה
  async function autoLogo(t, domain, quiet) {
    const d = cleanDomain(domain);
    if (!d) { setDomFor({ id: t.id, v: '' }); return; }
    setBusy(t.id); setErr('');
    try {
      const r = await fetch('/api/logo?d=' + encodeURIComponent(d));
      if (!r.ok) throw new Error('none');
      const url = await uploadPhoto(await shrink(await r.blob(), 256, '#ffffff'));
      const x = await api.saveTag(ctx.shopId, { ...t, logo_url: url });
      ctx.applyTags([x]); setDomFor(null);
      ctx.toast('הלוגו של ' + t.name + ' נוסף ✓');
    } catch {
      if (!quiet) setErr(`לא מצאתי לוגו באתר ${d}. אפשר לנסות כתובת אחרת, או להעלות תמונה (🖼️).`);
      setDomFor({ id: t.id, v: d });
    }
    setBusy('');
  }
  async function save() {
    try { const t = await api.saveTag(ctx.shopId, edit); ctx.applyTags([t]); setEdit(null); ctx.toast('נשמר'); } catch (er) { setErr(errText(er)); }
  }
  async function remove(t) {
    try { await api.deleteTag(ctx.shopId, t.id); ctx.applyTags([{ ...t, deleted_at: new Date().toISOString() }]); setDel(null); ctx.toast('נמחק'); } catch (er) { setErr(errText(er)); }
  }
  async function up(i) {
    const ids = list.map((t) => t.id);
    [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
    ctx.applyTags(ids.map((id, n) => ({ ...ctx.tagsById[id], sort: n + 1 })));
    try { await api.sortTags(ctx.shopId, ids); } catch (er) { setErr(errText(er)); }
  }
  async function logo(file) {
    const t = logoFor.current;
    if (!t) return;
    setBusy(t.id); setErr('');
    try { const url = await uploadPhoto(await shrink(file, 256, '#ffffff')); const r = await api.saveTag(ctx.shopId, { ...t, logo_url: url }); ctx.applyTags([r]); ctx.toast('הלוגו עודכן ✓'); }
    catch (er) { setErr('העלאת הלוגו נכשלה: ' + errText(er)); }
    setBusy('');
  }
  return (
    <>
      <Back onClick={back} />
      <div className="h2">{isCo ? '🏢 חברות' : '🗂️ קטגוריות'}</div>
      <div className="muted small">{isCo ? 'חברות עם לוגו: יצרנים, חברות סלולר, סינונים, ספקים. הלוגו נכנס לבד מהאתר של החברה (🌐), או מעלים תמונה (🖼️).' : 'הקוביות בדף הראשי. כל קטגוריה אפשר לחלק לפי חברות.'}</div>
      <form className="row" style={{ marginTop: 10 }} onSubmit={add}>
        {!isCo && <input className="input" style={{ width: 62, textAlign: 'center', flex: 'none' }} value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="אימוג'י" />}
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={isCo ? 'חברה חדשה…' : 'קטגוריה חדשה…'} />
        <button className="btn primary" type="submit">הוספה</button>
      </form>
      {isCo && name.trim() && (
        <div className="row" style={{ marginTop: 6 }}>
          <span className="muted small" style={{ flex: 'none' }}>🌐 אתר (ללוגו):</span>
          <input className="input sm grow ltr" value={site} onChange={(e) => setSite(e.target.value)} placeholder={guessDomain(name) || 'example.co.il'} />
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <div className="list" style={{ marginTop: 10 }}>
        {!list.length && <div className="empty">עוד אין {isCo ? 'חברות' : 'קטגוריות'}. מוסיפים למעלה.</div>}
        {list.map((t, i) => (
          <div key={t.id} className="card mrow">
            {isCo ? <button onClick={() => { logoFor.current = t; fileRef.current?.click(); }} aria-label="לוגו" disabled={busy === t.id}>{busy === t.id ? <span className="spin sm" /> : <CoLogo co={t} size={34} />}</button>
              : edit?.id === t.id ? <input className="input sm" style={{ width: 52, textAlign: 'center' }} value={edit.emoji || ''} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} /> : <span className="e">{t.emoji || '🗂️'}</span>}
            {edit?.id === t.id ? (
              <><input className="input sm grow" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
                <button className="btn sm primary" onClick={save}>✓</button><button className="btn sm" onClick={() => setEdit(null)}>✕</button></>
            ) : del === t.id ? (
              <><span className="grow" style={{ color: 'var(--red)' }}>למחוק? (המידע עצמו לא יימחק)</span><button className="btn sm danger" onClick={() => remove(t)}>מחיקה</button><button className="btn sm" onClick={() => setDel(null)}>ביטול</button></>
            ) : (
              <><span className="grow"><b>{t.name}</b> <span className="muted small">{counts[t.id] || 0}</span></span>
                {isCo && <button className="ib" onClick={() => autoLogo(t, guessDomain(t.name))} aria-label="לוגו אוטומטי מהאתר">🌐</button>}
                {isCo && <button className="ib" onClick={() => { logoFor.current = t; fileRef.current?.click(); }} aria-label="העלאת לוגו">🖼️</button>}
                <button className="ib" disabled={i === 0} onClick={() => up(i)} aria-label="למעלה">▲</button>
                <button className="ib" onClick={() => setEdit({ ...t })} aria-label="שינוי שם">✏️</button>
                {ctx.isAdmin && <button className="ib" onClick={() => setDel(t.id)} aria-label="מחיקה">🗑️</button>}</>
            )}
            {domFor?.id === t.id && (
              <form className="row dom-row" onSubmit={(e) => { e.preventDefault(); autoLogo(t, domFor.v); }}>
                <span className="muted small">🌐 האתר של {t.name}:</span>
                <input className="input sm grow ltr" autoFocus value={domFor.v} onChange={(e) => setDomFor({ id: t.id, v: e.target.value })} placeholder="example.co.il" />
                <button className="btn sm primary" type="submit">לוגו</button>
                <button className="btn sm" type="button" onClick={() => setDomFor(null)}>✕</button>
              </form>
            )}
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) logo(f); e.target.value = ''; }} />
    </>
  );
}

// סוגי מידע: שם, אימוג'י, הסתרה וסדר (רק מנהל)
function TypesList({ ctx, back }) {
  const s0 = ctx.shop.settings || {};
  const [types, setTypes] = useState(() => ({ ...(s0.types || {}) }));
  const [order, setOrder] = useState(() => { const o = s0.typeOrder || []; return [...o.filter((k) => TYPES.some((t) => t.k === k)), ...TYPES.map((t) => t.k).filter((k) => !o.includes(k))]; });
  const [err, setErr] = useState('');
  const setT = (k, patch) => setTypes((x) => ({ ...x, [k]: { ...(x[k] || {}), ...patch } }));
  async function save() {
    try { const r = await api.setSettings(ctx.shopId, { ...s0, types, typeOrder: order }); ctx.setShop({ settings: r }); ctx.toast('נשמר ✓'); back(); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <Back onClick={back} />
      <div className="h2">🧾 סוגי מידע</div>
      <div className="muted small">הסוג קובע אילו שדות יש לפריט ואילו כפתורים (Waze, חיוג, העתקה). אפשר לשנות שם, להסתיר ולסדר.</div>
      <div className="list" style={{ marginTop: 10 }}>
        {order.map((k, i) => {
          const t = TYPES.find((x) => x.k === k);
          const o = types[k] || {};
          return (
            <div key={k} className={'card mrow' + (o.hidden ? ' off' : '')}>
              <input className="input sm" style={{ width: 52, textAlign: 'center' }} value={o.e ?? t.e} onChange={(e) => setT(k, { e: e.target.value })} disabled={!ctx.isAdmin} />
              <input className="input sm grow" value={o.label ?? t.label} onChange={(e) => setT(k, { label: e.target.value })} disabled={!ctx.isAdmin} />
              <button className="ib" disabled={i === 0 || !ctx.isAdmin} onClick={() => { const n = [...order]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setOrder(n); }} aria-label="למעלה">▲</button>
              <button className="btn sm" disabled={!ctx.isAdmin} onClick={() => setT(k, { hidden: !o.hidden })}>{o.hidden ? 'מוסתר' : 'מוצג'}</button>
            </div>
          );
        })}
      </div>
      {err && <div className="err">{err}</div>}
      {ctx.isAdmin ? <button className="btn primary block" style={{ marginTop: 12 }} onClick={save}>שמירה</button> : <div className="muted small" style={{ marginTop: 8 }}>רק מנהל יכול לשנות.</div>}
    </>
  );
}

// מצבי מלאי: שם ואימוג'י (רק מנהל)
function StatusList({ ctx, back }) {
  const s0 = ctx.shop.settings || {};
  const [st, setSt] = useState(() => ({ ...(s0.status || {}) }));
  const [err, setErr] = useState('');
  async function save() {
    try { const r = await api.setSettings(ctx.shopId, { ...s0, status: st }); ctx.setShop({ settings: r }); ctx.toast('נשמר ✓'); back(); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <Back onClick={back} />
      <div className="h2">📦 מצבי מלאי</div>
      <div className="muted small">השמות שמופיעים כשמדווחים על מוצר ובמסך המלאי.</div>
      <div className="list" style={{ marginTop: 10 }}>
        {STOCK_ST.map((s) => (
          <div key={s.k} className="card mrow">
            <input className="input sm" style={{ width: 52, textAlign: 'center' }} value={st[s.k]?.e ?? s.e} disabled={!ctx.isAdmin} onChange={(e) => setSt((x) => ({ ...x, [s.k]: { ...(x[s.k] || {}), e: e.target.value } }))} />
            <input className="input sm grow" value={st[s.k]?.label ?? s.label} disabled={!ctx.isAdmin} onChange={(e) => setSt((x) => ({ ...x, [s.k]: { ...(x[s.k] || {}), label: e.target.value } }))} />
          </div>
        ))}
      </div>
      {err && <div className="err">{err}</div>}
      {ctx.isAdmin ? <button className="btn primary block" style={{ marginTop: 12 }} onClick={save}>שמירה</button> : <div className="muted small" style={{ marginTop: 8 }}>רק מנהל יכול לשנות.</div>}
    </>
  );
}

// מוצרים וברקודים (בשביל סריקה וחיפוש)
function Products({ ctx, back, edit0 }) {
  const blank = { id: null, name: '', barcode: '', price: '', company_id: '' };
  const [p, setP] = useState(() => ({ ...blank, ...(edit0 || {}), price: edit0?.price ?? '' }));
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const list = ctx.products.filter((x) => !q || norm(`${x.name} ${x.barcode}`).includes(norm(q)));
  async function save() {
    if (!p.name.trim()) { setErr('שם המוצר?'); return; }
    setErr('');
    try { const r = await api.saveProduct(ctx.shopId, { ...p, price: String(p.price ?? '').replace(/[^\d.]/g, '') }); ctx.apply('products', r); setP(blank); ctx.toast('נשמר ✓'); }
    catch (e) { setErr(errText(e)); }
  }
  async function del(x) {
    if (!confirm(`למחוק את "${x.name}"?`)) return;
    try { await api.deleteProduct(ctx.shopId, x.id); ctx.apply('products', { ...x, deleted_at: new Date().toISOString() }); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <Back onClick={back} />
      <div className="h2">🏷️ מוצרים וברקודים</div>
      <div className="muted small">מוצר עם ברקוד נמצא בסריקה (מצלמה בטלפון, או סורק במחשב שכותב לתיבת החיפוש).</div>
      <div className="card pad" style={{ marginTop: 10 }}>
        <b>{p.id ? 'עריכת מוצר' : '➕ מוצר חדש'}</b>
        <input className="input" style={{ marginTop: 8 }} placeholder="שם המוצר" value={p.name} onChange={(e) => set('name', e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow ltr" inputMode="numeric" placeholder="ברקוד" value={p.barcode} onChange={(e) => set('barcode', e.target.value)} />
          <button className="btn" onClick={() => ctx.open({ t: 'barcode', onPick: (c) => set('barcode', c) })} aria-label="סריקה">📷</button>
          <input className="input" style={{ width: 100 }} inputMode="decimal" placeholder="מחיר ₪" value={p.price ?? ''} onChange={(e) => set('price', e.target.value)} />
        </div>
        <div className="chips wrapped">
          {ctx.companies.map((c) => <button key={c.id} className={'chip' + (p.company_id === c.id ? ' on' : '')} onClick={() => set('company_id', p.company_id === c.id ? '' : c.id)}><CoLogo co={c} size={20} /> {c.name}</button>)}
        </div>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary grow" onClick={save}>{p.id ? 'שמירה' : 'הוספה'}</button>
          {p.id && <button className="btn" onClick={() => setP(blank)}>ביטול</button>}
        </div>
      </div>
      {ctx.products.length > 6 && <input className="input" style={{ marginTop: 10 }} placeholder="חיפוש מוצר…" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="list" style={{ marginTop: 10 }}>
        {list.map((x) => (
          <div key={x.id} className="card mrow">
            <span className="e">🏷️</span>
            <span className="grow"><b>{x.name}</b><div className="muted small">{[ctx.tagsById[x.company_id]?.name, x.barcode, ils(x.price)].filter(Boolean).join(' · ')}</div></span>
            <button className="ib" onClick={() => setP({ ...x, price: x.price ?? '' })} aria-label="עריכה">✏️</button>
            <button className="ib" onClick={() => del(x)} aria-label="מחיקה">🗑️</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Trash({ ctx, back }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.deletedItems(ctx.shopId).then(setList).catch((e) => setErr(errText(e))); }, [ctx.shopId]);
  async function restore(it) {
    try { await api.restoreItem(ctx.shopId, it.id); setList((l) => l.filter((x) => x.id !== it.id)); ctx.applyItem({ ...it, deleted_at: null }); ctx.toast('שוחזר'); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <Back onClick={back} />
      <div className="h2">🗑️ מידע שנמחק</div>
      {err && <div className="err">{err}</div>}
      {list === null && !err && <div className="spin" />}
      {list?.length === 0 && <div className="empty">אין מידע שנמחק</div>}
      {list?.map((it) => (
        <div key={it.id} className="card it">
          <div className="ic">{typeOf(it.type, ctx.shop).e}</div>
          <div className="grow"><div className="t">{it.title}</div><div className="s">נמחק ע״י {it.updated_by_name} · {timeAgo(it.deleted_at)}</div></div>
          <button className="btn sm" onClick={() => restore(it)}>שחזור</button>
        </div>
      ))}
    </>
  );
}

function Misses({ ctx, back }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.misses(ctx.shopId).then(setList).catch((e) => setErr(errText(e))); }, [ctx.shopId]);
  async function set(m, status) {
    try { await api.missSet(ctx.shopId, m.id, status); setList((l) => l.filter((x) => x.id !== m.id)); ctx.refresh(); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <Back onClick={back} />
      <div className="h2">🔍 חיפושים שלא נמצאו</div>
      <div className="muted small" style={{ marginBottom: 8 }}>עובדים חיפשו את זה ולא מצאו. מוסיפים, או מוחקים אם לא רלוונטי.</div>
      {err && <div className="err">{err}</div>}
      {list === null && !err && <div className="spin" />}
      {list?.length === 0 && <div className="empty"><div className="e">🎉</div>אין כרגע חיפושים שלא נמצאו</div>}
      {list?.map((m) => (
        <div key={m.id} className="card it" style={{ alignItems: 'center' }}>
          <div className="ic">🔍</div>
          <div className="grow"><div className="t">{m.query}</div><div className="s">חיפשו {m.count} פעמים · אחרון: {m.last_by_name} {timeAgo(m.last_at)}</div></div>
          <button className="btn sm primary" onClick={() => { set(m, 'done'); ctx.replace({ t: 'edit', draft: { title: m.query } }); }}>➕ הוספה</button>
          <button className="btn sm" onClick={() => set(m, 'ignored')} aria-label="לא רלוונטי">✕</button>
        </div>
      ))}
    </>
  );
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const Row = ({ e, t, s, n, onClick, href }) => {
  const inner = <><span className="e">{e}</span><span className="grow">{t}{s && <div className="muted small">{s}</div>}</span>{n ? <span className="dot" style={{ position: 'static' }}>{n}</span> : null}<span className="muted">‹</span></>;
  return href ? <a href={href}>{inner}</a> : <button onClick={onClick}>{inner}</button>;
};

export default function Settings({ ctx, view: view0, edit }) {
  const [view, setView] = useState(view0 || '');
  const [name, setName] = useState(ctx.shop.name);
  const [err, setErr] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoRef = useRef(null);
  const back = () => (view0 ? ctx.close() : setView(''));
  async function setLogo(file) {
    setLogoBusy(true); setErr('');
    try { const url = file ? await uploadPhoto(await shrink(file, 512, '#ffffff')) : ''; await api.setLogo(ctx.shopId, url); await ctx.refresh(); ctx.toast(file ? 'הלוגו עודכן' : 'הלוגו הוסר'); }
    catch (e) { setErr(errText(e)); }
    setLogoBusy(false);
  }
  function exportCSV() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['כותרת', 'סוג', 'קטגוריה', 'חברה', ...ALL_FIELDS.map((k) => FIELDS[k].label), 'פרטים', 'נוסף ע"י', 'עודכן'];
    const rows = ctx.items.map((it) => [it.title, typeOf(it.type, ctx.shop).label, catOf(it, ctx.tagsById)?.name, coOf(it, ctx.tagsById)?.name, ...ALL_FIELDS.map((k) => it.fields?.[k] || ''), it.body, it.created_by_name, it.updated_at?.slice(0, 10)]);
    download(`מידע-${ctx.shop.name}.csv`, '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    download(`גיבוי-${ctx.shop.name}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ shop: ctx.shop.name, at: new Date().toISOString(), tags: ctx.tags, items: ctx.items, products: ctx.products, deals: ctx.deals }, null, 1), 'application/json');
  }
  async function rename() {
    try { await api.updateShop(ctx.shopId, name, null, false); ctx.refresh(); ctx.toast('נשמר'); } catch (e) { setErr(errText(e)); }
  }
  async function leave() {
    if (!confirm('לצאת מהחנות? כדי לחזור תצטרך קישור הצטרפות ואישור.')) return;
    try { await api.leave(ctx.shopId); clearCached(ctx.shopId); setLastShop(''); location.replace('/?all'); } catch (e) { setErr(errText(e)); }
  }
  const s = ctx.shop.settings || {};
  const typesSub = ctx.types.slice(0, 4).map((t) => t.label).join(' · ');

  let body;
  if (view === 'category' || view === 'company') body = <TagList ctx={ctx} kind={view} back={back} />;
  else if (view === 'types') body = <TypesList ctx={ctx} back={back} />;
  else if (view === 'status') body = <StatusList ctx={ctx} back={back} />;
  else if (view === 'products') body = <Products ctx={ctx} back={back} edit0={edit} />;
  else if (view === 'misses') body = <Misses ctx={ctx} back={back} />;
  else if (view === 'trash') body = <Trash ctx={ctx} back={back} />;
  else if (view === 'bonus') body = <Bonus ctx={ctx} back={back} />;
  else body = (
    <>
      <div className="muted small">מחובר בתור {userName(ctx.user)} · {ctx.items.length} פריטי מידע</div>
      <div className="h2">רשימות · הוספה, שינוי שם, סדר ומחיקה</div>
      <div className="card menu-list">
        <Row e="🗂️" t={`קטגוריות (${ctx.categories.length})`} s={ctx.categories.slice(0, 4).map((c) => c.name).join(' · ')} onClick={() => setView('category')} />
        <Row e="🏢" t={`חברות (${ctx.companies.length})`} s={ctx.companies.length ? ctx.companies.slice(0, 4).map((c) => c.name).join(' · ') : 'עוד אין — מוסיפים כאן, עם לוגו'} onClick={() => setView('company')} />
        <Row e="🧾" t="סוגי מידע" s={typesSub} onClick={() => setView('types')} />
        <Row e="📦" t="מצבי מלאי" s={STOCK_ST.map((x) => stockSt(x.k, ctx.shop).label).join(' · ')} onClick={() => setView('status')} />
      </div>
      <div className="h2">לכל העובדים</div>
      <div className="card menu-list">
        <Row e="⭐" t="מבצעים" s={`${ctx.deals.filter((d) => !d.deleted_at).length} מבצעים · כל עובד יכול לעדכן`} onClick={() => ctx.replace({ t: 'deals' })} />
        <Row e="🏷️" t={`מוצרים וברקודים (${ctx.products.length})`} s="שם, ברקוד ומחיר — לסריקה" onClick={() => setView('products')} />
        <Row e="💬" t="ייבוא מוואטסאפ" onClick={() => ctx.replace({ t: 'import' })} />
        <Row e="✨" t="שאל את המאגר" s="שאלה חופשית, תשובה רק מהמידע של החנות" onClick={() => ctx.replace({ t: 'ask' })} />
        <Row e="🔢" t="סריקת IMEI" onClick={() => ctx.replace({ t: 'scan', onPick: (n) => setTimeout(() => ctx.open({ t: 'edit', draft: { type: 'imei', fields: { imei: n } } }), 300) })} />
        <Row e="🔍" t="חיפושים שלא נמצאו" s="מה עובדים חיפשו ולא היה במאגר" n={ctx.shop.misses} onClick={() => setView('misses')} />
      </div>
      <div className="h2">החנות</div>
      <div className="card menu-list">
        <Row e="👥" t="עובדים והזמנה" n={ctx.isAdmin ? ctx.shop.pending : 0} onClick={() => ctx.replace({ t: 'team' })} />
        {ctx.isAdmin && <Row e="💰" t="בונוסים" s="דוח חודשי מיומן הבונוסים · רק מנהלים" onClick={() => setView('bonus')} />}
        {ctx.isAdmin && <Row e="🗑️" t="מידע שנמחק" onClick={() => setView('trash')} />}
        <Row e="📊" t="ייצוא לאקסל" onClick={exportCSV} />
        <Row e="💾" t="גיבוי מלא (קובץ)" onClick={exportJSON} />
        <Row e="🏪" t="החלפת חנות / חנות חדשה" href="/?all" />
      </div>
      <PushToggle ctx={ctx} />
      <div style={{ marginTop: 12 }}><InstallButton /></div>
      {ctx.isAdmin && (
        <div className="card pad" style={{ marginTop: 12 }}>
          <b>לוגו ושם החנות</b>
          <div className="row" style={{ marginTop: 8 }}>
            {ctx.shop.logo_url ? <img className="shop-logo" style={{ width: 64, height: 64 }} src={ctx.shop.logo_url} alt="" /> : <div className="shop-logo ini" style={{ width: 64, height: 64 }}>{ctx.shop.name.charAt(0)}</div>}
            <button className="btn sm" disabled={logoBusy} onClick={() => logoRef.current?.click()}>{logoBusy ? 'מעלה…' : ctx.shop.logo_url ? 'החלפה' : 'העלאת לוגו'}</button>
            {ctx.shop.logo_url && <button className="btn sm danger" disabled={logoBusy} onClick={() => setLogo(null)}>הסרה</button>}
            <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setLogo(f); e.target.value = ''; }} />
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>הלוגו הוא גם האייקון של האפליקציה במסך הבית.</div>
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn" onClick={rename}>שמירה</button>
          </div>
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <div className="row wrap-row" style={{ marginTop: 14 }}>
        <button className="btn sm" onClick={() => signOut().then(() => { setLastShop(''); location.replace('/'); })}>התנתקות</button>
        {ctx.shop.role !== 'owner' && <button className="btn sm danger" onClick={leave}>יציאה מהחנות</button>}
      </div>
      {s && null}
    </>
  );

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>הגדרות</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {body}
    </Sheet>
  );
}
