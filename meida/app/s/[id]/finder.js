'use client';
// 🏢 לפי חברה / דגם: כל מה שיש באפליקציה על חברה או דגם — מידע, מקשים, הוראות, שאלות ומחירים (כל ההיסטוריה), חוסרים, פתקים, מוצרים, הודעות
import { useEffect, useMemo, useState } from 'react';
import Page from '@/components/Page';
import CoLogo from '@/components/CoLogo';
import ItemRow from '@/components/ItemRow';
import { api } from '@/lib/api';
import { ALIAS } from '@/lib/tags';
import { norm, ils, askKind, stockSt, noteKind, NOTE_ST, coOf } from '@/lib/kb';
import { devicesOf } from './devices';

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const squash = (s) => norm(s).replace(/\s+/g, '');
const fmt = (iso) => new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });

// כל השמות של חברה (עברית / אנגלית / שמות של סדרות): שיאומי = xiaomi = redmi
export function companyTerms(name) {
  const n = norm(name);
  const out = new Set([n]);
  if (ALIAS[n]) out.add(norm(ALIAS[n]));
  for (const [k, v] of Object.entries(ALIAS)) if (norm(v) === n || norm(k) === n) { out.add(norm(k)); out.add(norm(v)); }
  return [...out].filter((x) => x.length >= 2);
}

const SECTIONS = [
  ['info', '📝 מידע'], ['asks', '💬 שאלות ומחירים'], ['stock', '📦 חוסרים'], ['notes', '📌 פתקים'],
  ['dev', '🔑 מקשים והוראות'], ['products', '🏷️ מוצרים'], ['posts', '📣 הודעות'],
];

export default function Finder({ ctx, coId }) {
  const [co, setCo] = useState(coId || '');
  const [model, setModel] = useState('');
  const [sec, setSec] = useState('all');
  const key = 'kb_asks_all_' + ctx.shopId;
  const [allAsks, setAllAsks] = useState(() => lsGet(key) || []);
  useEffect(() => {
    ctx.loadDevs();
    api.asksHistory(ctx.shopId).then((l) => { if (Array.isArray(l)) { setAllAsks(l); lsSet(key, l); } }).catch(() => {});
  }, []); // eslint-disable-line

  const company = co ? ctx.tagsById[co] : null;
  const res = useMemo(() => {
    const terms = company ? companyTerms(company.name) : [];
    const m = norm(model);
    const ms = squash(model);
    if (!company && m.length < 2) return null;
    // טקסט מתאים: מזכיר את הדגם (אם נכתב — הדגם מספיק, גם בלי שם החברה), אחרת את החברה. "13 c" = "13c"
    const ok = (text, coMatch) => {
      const t = norm(text);
      if (company && !m && !coMatch && !terms.some((w) => t.includes(w))) return false;
      if (m && !t.includes(m) && !t.replace(/\s+/g, '').includes(ms)) return false;
      return true;
    };
    const items = ctx.items.filter((it) => ok(ctx.index.get(it.id)?.text || '', coOf(it, ctx.tagsById)?.id === co))
      .sort((a, b) => (b.pinned - a.pinned) || new Date(b.updated_at) - new Date(a.updated_at));
    const dev = [...devicesOf(ctx, 'keys'), ...devicesOf(ctx, 'samvix')].filter((d) => ok(`${d.name} ${d.brand} ${d.list === 'samvix' ? 'samvix סמוויקס' : ''}`, false))
      .sort((a, b) => !!(b.info?.key || b.info?.body || b.info?.video) - !!(a.info?.key || a.info?.body || a.info?.video));
    // שאלות: ההיסטוריה המלאה + מה שנטען עכשיו (העדכני מנצח)
    const am = new Map(allAsks.map((a) => [a.id, a]));
    for (const a of ctx.asks) am.set(a.id, a);
    const asks = [...am.values()].filter((a) => !a.deleted_at && ok(`${a.product} ${a.note} ${(a.answers || []).map((x) => x.note).join(' ')}`, false))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const stock = ctx.stock.filter((x) => !x.deleted_at && ok(`${x.name} ${x.note || ''}`, x.company_id === co && !!co)).sort((a, b) => (a.status === 'arrived') - (b.status === 'arrived') || new Date(b.updated_at) - new Date(a.updated_at));
    const notes = ctx.notes.filter((x) => !x.deleted_at && ok(`${x.title} ${x.customer || ''}`, x.company_id === co && !!co)).sort((a, b) => (a.status === 'done') - (b.status === 'done') || new Date(b.created_at) - new Date(a.created_at));
    const products = ctx.products.filter((p) => !p.deleted_at && ok(`${p.name} ${p.barcode || ''}`, p.company_id === co && !!co));
    const posts = ctx.posts.filter((p) => !p.deleted_at && ok(`${p.title || ''} ${p.body || ''}`, false)).slice(0, 30);
    return { info: items, dev, asks, stock, notes, products, posts };
  }, [co, model, ctx.items, ctx.index, ctx.devs, ctx.sitePhones, allAsks, ctx.asks, ctx.stock, ctx.notes, ctx.products, ctx.posts]); // eslint-disable-line

  const total = res ? SECTIONS.reduce((n, [k]) => n + res[k].length, 0) : 0;
  const show = (k) => res && res[k].length > 0 && (sec === 'all' || sec === k);
  const coName = (id) => ctx.tagsById[id]?.name;

  return (
    <Page onBack={ctx.close} title="🏢 לפי חברה / דגם">
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {ctx.companies.map((c) => (
          <button key={c.id} className={'chip' + (co === c.id ? ' on' : '')} onClick={() => { setCo(co === c.id ? '' : c.id); setSec('all'); }}><CoLogo co={c} size={20} /> {c.name}</button>
        ))}
        {!ctx.companies.length && <span className="muted small">עוד אין חברות — אפשר לחפש לפי דגם</span>}
      </div>
      <div className="search" style={{ marginTop: 8 }}>
        <span>🔎</span>
        <input className="input" type="search" placeholder={company ? `דגם של ${company.name} (לא חובה)…` : 'דגם או מכשיר, למשל: Redmi 13C, Q7…'} value={model} onChange={(e) => { setModel(e.target.value); setSec('all'); }} />
        {model && <button onClick={() => setModel('')} aria-label="נקה">✕</button>}
      </div>

      {!res && <div className="empty"><div className="e">🏢</div>בוחרים חברה, כותבים דגם — או שניהם.<div className="muted small" style={{ marginTop: 6 }}>יופיע כל מה שיש: מידע, קבצים, מקש לגירסה, הוראות, מי שאל מחיר ומתי, חוסרים ופתקים.</div></div>}

      {res && <>
        <div className="seg scroll" style={{ marginTop: 10 }}>
          <button className={sec === 'all' ? 'on' : ''} onClick={() => setSec('all')}>הכל · {total}</button>
          {SECTIONS.filter(([k]) => res[k].length).map(([k, l]) => <button key={k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}>{l} · {res[k].length}</button>)}
        </div>
        {!total && <div className="empty"><div className="e">🤷</div>אין עדיין כלום על {[company?.name, model.trim()].filter(Boolean).join(' ')}
          <div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => ctx.open({ t: 'edit', draft: { tag_ids: co ? [co] : [], fields: model.trim() ? { model: model.trim() } : {} } })}>➕ הוספת מידע</button></div></div>}

        {show('info') && <><div className="h2">📝 מידע ({res.info.length})</div>{res.info.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} hideCat={false} />)}</>}

        {show('asks') && <><div className="h2">💬 שאלות ומחירים ({res.asks.length})</div><div className="list">{res.asks.map((a) => {
          const k = askKind(a.kind);
          const ans = a.answers || [];
          return (
            <div key={a.id} className="card srow">
              <div className="top2">
                {a.photos?.[0] ? <img className="ask-ph" src={a.photos[0]} alt="" /> : <span className="e">{k.e}</span>}
                <div className="grow">
                  <b>{a.product || k.label}</b>
                  {a.note && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{a.note}</div>}
                  <div className="muted small when">{k.label} · שאל/ה: {a.asked_by_name || '—'} · {fmt(a.created_at)}</div>
                </div>
                <span className={'pill ' + (!ans.length && a.status === 'open' ? 'p-low' : a.status === 'closed' ? 'p-gray' : 'p-in')}>{!ans.length && a.status === 'open' ? 'מחכה' : a.status === 'closed' ? 'סגור' : 'נענה'}</span>
              </div>
              {ans.map((x) => (
                <div key={x.id} className="ans-b">
                  {x.price !== null && x.price !== undefined && <b className="price">{ils(x.price)}</b>}
                  <span className="grow">{x.note}</span>
                  <span className="muted small when">{x.by_name} · {fmt(x.created_at)}</span>
                </div>
              ))}
            </div>
          );
        })}</div></>}

        {show('stock') && <><div className="h2">📦 חוסרים ({res.stock.length})</div><div className="list">{res.stock.map((x) => (
          <button key={x.id} className="card it" onClick={() => { ctx.close(); ctx.setTab('stock'); }}><div className="ic">📦</div><div className="grow"><div className="t">{x.name}</div><div className="s">{[coName(x.company_id), x.created_by_name, fmtDay(x.created_at)].filter(Boolean).join(' · ')}</div></div><span className={'pill ' + stockSt(x.status, ctx.shop).cls}>{stockSt(x.status, ctx.shop).label}</span></button>
        ))}</div></>}

        {show('notes') && <><div className="h2">📌 פתקים ({res.notes.length})</div><div className="list">{res.notes.map((x) => (
          <button key={x.id} className="card it" onClick={() => { ctx.close(); ctx.setTab('notes'); }}><div className="ic">{noteKind(x.kind).e}</div><div className="grow"><div className="t">{x.title}</div><div className="s">{[x.customer, x.author_name, fmtDay(x.created_at), x.times > 1 && `${x.times} לקוחות ביקשו`].filter(Boolean).join(' · ')}</div></div><span className={'pill ' + (NOTE_ST[x.status] || NOTE_ST.waiting).cls}>{(NOTE_ST[x.status] || NOTE_ST.waiting).label}</span></button>
        ))}</div></>}

        {show('dev') && <><div className="h2">🔑 מקש לגירסה והוראות ({res.dev.length})</div><div className="list">{res.dev.map((d) => (
          <button key={d.list + d.id} className="card dv-row" onClick={() => ctx.open({ t: 'dev', list: d.list, id: d.id })}>
            {d.pic ? <img className="dv-pic" src={d.pic} alt="" loading="lazy" /> : <span className="dv-pic none">{d.list === 'keys' ? '📱' : '🎵'}</span>}
            <span className="grow" style={{ minWidth: 0 }}><b>{d.name}</b><div className="muted small dv-note">{d.brand}{d.list === 'keys' ? (d.info?.note ? ' · ' + d.info.note : '') : ' · ' + ([d.info?.body && '📝 הוראות', d.info?.video && '🎬 סרטון'].filter(Boolean).join(' · ') || 'עוד אין הוראות')}</div></span>
            {d.list === 'keys' && <span className={'dv-key' + (d.info?.key ? ' has' : '')}>{d.info?.key || '+ מקש'}</span>}
          </button>
        ))}</div></>}

        {show('products') && <><div className="h2">🏷️ מוצרים ({res.products.length})</div><div className="list">{res.products.map((p) => (
          <button key={p.id} className="card it" onClick={() => ctx.open({ t: 'settings', view: 'products', edit: p })}><div className="ic">🏷️</div><div className="grow"><div className="t">{p.name}</div><div className="s ltr" style={{ textAlign: 'start' }}>{p.barcode}</div></div>{p.price !== null && p.price !== undefined && <b className="price">{ils(p.price)}</b>}</button>
        ))}</div></>}

        {show('posts') && <><div className="h2">📣 הודעות ({res.posts.length})</div><div className="list">{res.posts.map((p) => (
          <button key={p.id} className="card it" onClick={() => ctx.open({ t: 'board' })}><div className="ic">📣</div><div className="grow"><div className="t">{p.title || (p.body || '').slice(0, 60)}</div><div className="s">{[p.author_name, fmtDay(p.created_at)].filter(Boolean).join(' · ')}</div></div></button>
        ))}</div></>}

        {total > 0 && <button className="btn dashed block" style={{ marginTop: 14 }} onClick={() => ctx.open({ t: 'edit', draft: { tag_ids: co ? [co] : [], fields: model.trim() ? { model: model.trim() } : {} } })}>➕ הוספת מידע{company ? ' ל' + company.name : ''}{model.trim() ? ' ' + model.trim() : ''}</button>}
      </>}
    </Page>
  );
}
