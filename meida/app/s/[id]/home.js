'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { queryWords, score, imeiInfo, norm, copyText, untilLabel, today, ils, stockSt, noteKind, NOTE_ST } from '@/lib/kb';
import ItemRow from '@/components/ItemRow';
import CoLogo from '@/components/CoLogo';
import { api } from '@/lib/api';
import { itemsInCat } from './cat';
import { devicesOf, searchDevices } from './devices';

// הודעה דחופה שעוד לא אישרתי — פס אדום עד שלוחצים "ראיתי"
export function UrgentBanner({ ctx }) {
  const p = ctx.urgentWaiting[0];
  const [busy, setBusy] = useState(false);
  if (!p) return null;
  async function ack() {
    setBusy(true);
    try {
      await api.markSeen(ctx.shopId, 'post', [p.id]);
      await ctx.refresh();
      ctx.notify({ ack: p.id });
      ctx.toast(`אישרת ✓ ${p.author_name} יודע שראית`);
    } catch { ctx.toast('אין חיבור — נסה שוב'); }
    setBusy(false);
  }
  return (
    <div className="urgent">
      <span className="e">🚨</span>
      <div className="grow" onClick={() => ctx.open({ t: 'board' })}>
        <b>דחוף מ{p.author_name}{ctx.urgentWaiting.length > 1 ? ` (+${ctx.urgentWaiting.length - 1})` : ''}</b>
        <div className="s">{p.title || p.body}</div>
      </div>
      <button className="btn" disabled={busy} onClick={ack}>✓ ראיתי</button>
    </div>
  );
}

function DealsStrip({ ctx }) {
  const list = ctx.deals.filter((d) => !d.deleted_at && (!d.until || d.until >= today())).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const [i, setI] = useState(0);
  const ref = useRef(null);
  if (!list.length) return <button className="btn dashed block" style={{ marginBottom: 10 }} onClick={() => ctx.open({ t: 'deals' })}>⭐ הוספת מבצע</button>;
  const onScroll = (e) => { const el = e.currentTarget; setI(Math.round(Math.abs(el.scrollLeft) / (el.clientWidth + 8))); };
  return (
    <>
      <div className="deals" ref={ref} onScroll={onScroll}>
        {list.map((d, n) => (
          <div key={d.id} className="deal">
            <span className="e">⭐</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="lbl">מבצע{list.length > 1 ? ` ${n + 1} מתוך ${list.length}` : ''} · {untilLabel(d.until)}</div>
              <b>{d.title}</b>
              {d.details && <div className="s">{d.details}</div>}
              <div className="by">עודכן ע״י {d.by_name}</div>
            </div>
            <button className="ed" onClick={() => ctx.open({ t: 'deals' })}>עריכה</button>
          </div>
        ))}
      </div>
      {list.length > 1 ? <div className="dots">{list.map((d, n) => <span key={d.id} className={n === i ? 'on' : ''} />)}</div> : <div style={{ height: 10 }} />}
    </>
  );
}

export default function HomeView({ ctx }) {
  const { items, index } = ctx;
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);
  const missed = useRef(new Set());
  const inputRef = useRef(null);
  useEffect(() => setLimit(40), [q]);
  const qq = q.trim();
  const imei = imeiInfo(qq);
  const words = queryWords(qq);

  const res = useMemo(() => {
    if (!qq) return null;
    const w = norm(qq);
    const digits = qq.replace(/\D/g, '');
    const numQ = digits;
    const info = [];
    for (const it of items) {
      const s = score(index.get(it.id), words, numQ);
      if (s) info.push([s + (it.pinned ? 0.5 : 0), it]);
    }
    info.sort((a, b) => b[0] - a[0] || new Date(b[1].updated_at) - new Date(a[1].updated_at));
    const products = ctx.products.filter((p) => (digits.length >= 6 && p.barcode && p.barcode.includes(digits)) || (w.length >= 2 && norm(p.name).includes(w))).slice(0, 8);
    return {
      info: info.map((x) => x[1]),
      products,
      cats: ctx.categories.filter((c) => norm(c.name).includes(w)),
      cos: ctx.companies.filter((c) => norm(c.name).includes(w)),
      stock: ctx.stock.filter((x) => x.status !== 'arrived' && norm(x.name).includes(w)).slice(0, 6),
      notes: ctx.notesOpen.filter((x) => norm(`${x.title} ${x.customer} ${x.phone}`).includes(w)).slice(0, 6),
      devs: searchDevices(ctx, w),
    };
  }, [qq, items, index, ctx.products, ctx.categories, ctx.companies, ctx.stock, ctx.notesOpen, ctx.devs]); // eslint-disable-line
  const none = res && !res.devs.length && !res.info.length && !res.products.length && !res.cats.length && !res.cos.length && !res.stock.length && !res.notes.length && !imei;

  // חיפוש שלא מצא כלום — נרשם ל"חיפושים שלא נמצאו" (אחרי שהפסיקו להקליד)
  useEffect(() => {
    if (qq.length < 3 || !none) return;
    const t = setTimeout(() => { if (!missed.current.has(qq)) { missed.current.add(qq); api.miss(ctx.shopId, qq).catch(() => {}); } }, 2500);
    return () => clearTimeout(t);
  }, [qq, none]); // eslint-disable-line

  const coName = (id) => ctx.tagsById[id]?.name;
  let keysDone = 0, svDone = 0;
  for (const r of ctx.devs.values()) { if (r.list === 'keys' && r.key) keysDone++; if (r.list === 'samvix' && (r.body || r.video)) svDone++; }
  const keysAll = devicesOf(ctx, 'keys').length;
  const catCount = (c) => itemsInCat(ctx, c).length;

  return (
    <>
      <div className="search">
        <span>🔎</span>
        <input ref={inputRef} className="input" type="search" enterKeyHint="search" placeholder="חיפוש או סריקת ברקוד…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q ? <button onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="נקה">✕</button>
          : <button className="scan-btn" onClick={() => ctx.open({ t: 'barcode', onPick: (n) => setQ(n) })} aria-label="סריקת ברקוד">📷</button>}
      </div>

      {!res ? (
        <>
          <UrgentBanner ctx={ctx} />
          <div style={{ height: 10 }} />
          <DealsStrip ctx={ctx} />
          <div className="actions">
            <button className="act stock" onClick={() => ctx.open({ t: 'report' })}><span className="e">📦</span><span><b>חסר במלאי</b><span className="s">דיווח מהיר</span></span>{ctx.stockOpen.length > 0 && <span className="dot">{ctx.stockOpen.length}</span>}</button>
            <button className="act" onClick={() => ctx.open({ t: 'ask-new' })}><span className="e">💬</span><span><b>שאלה לצוות</b><span className="s">מחיר, יש לנו?, כללי</span></span>{ctx.asksWaiting.length > 0 && <span className="dot amber">{ctx.asksWaiting.length}</span>}</button>
            <button className="act" onClick={() => ctx.open({ t: 'note' })}><span className="e">📌</span><span><b>פתק פתוח</b><span className="s">שלא נשכח</span></span>{ctx.notesOpen.length > 0 && <span className="dot violet">{ctx.notesOpen.length}</span>}</button>
            <button className="act" onClick={() => ctx.open({ t: 'edit' })}><span className="e">➕</span><span><b>הוספת מידע</b><span className="s">לכל קטגוריה</span></span></button>
            <button className="act" onClick={() => ctx.open({ t: 'keys' })}><span className="e">🔑</span><span><b>מקש לגירסה</b><span className="s">{keysDone ? `${keysDone} מתוך ${keysAll}` : 'כשרים ותומכי כשר'}</span></span></button>
            <button className="act" onClick={() => ctx.open({ t: 'samvix' })}><span className="e">🎵</span><span><b>גרסאות סמוויקס</b><span className="s">{svDone ? `${svDone} עם הוראות` : 'הוראות וסרטונים'}</span></span></button>
          </div>
          <div className="h2">🗂️ קטגוריות<button className="more" onClick={() => ctx.open({ t: 'settings', view: 'category' })}>עריכה</button></div>
          {ctx.categories.length ? (
            <div className="cats">
              {ctx.categories.map((c) => {
                const n = catCount(c);
                return (
                  <button key={c.id} className="cat" onClick={() => ctx.open({ t: 'cat', id: c.id })}>
                    <span className="e">{c.emoji || '🗂️'}</span>
                    <span className="g"><b>{c.name}</b><span className="n">{n ? (n === 1 ? 'פריט אחד' : n + ' פריטים') : 'ריק'}</span></span>
                  </button>
                );
              })}
            </div>
          ) : <div className="empty">עוד אין קטגוריות. <button className="btn sm" onClick={() => ctx.open({ t: 'settings', view: 'category' })}>הוספה</button></div>}
          {!items.length && (
            <div className="card pad" style={{ marginTop: 14 }}>
              <b>👋 איך מתחילים?</b>
              <div className="muted small" style={{ margin: '6px 0 10px' }}>מוסיפים מידע אחד-אחד, או מעבירים בבת אחת את מה שרשמת בצ'אט בוואטסאפ.</div>
              <div className="row wrap-row">
                <button className="btn primary sm" onClick={() => ctx.open({ t: 'edit' })}>➕ הוספת מידע</button>
                <button className="btn sm" onClick={() => ctx.open({ t: 'import' })}>💬 ייבוא מוואטסאפ</button>
                {ctx.isAdmin && <button className="btn sm" onClick={() => ctx.open({ t: 'team' })}>👥 הזמנת עובדים</button>}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 8 }}>
          {imei && (
            <div className={'notice ' + (imei.ok ? 'ok-box' : 'bad-box')}>
              <div className="row">
                <div className="grow">
                  {imei.fixed ? <>14 ספרות — ה-IMEI המלא (עם ספרת ביקורת):</> : imei.ok ? '✓ IMEI תקין' : '✗ IMEI לא תקין (ספרת הביקורת לא מתאימה)'}
                  <div className="mono" style={{ fontSize: 19, marginTop: 2 }}>{imei.imei}</div>
                </div>
                <button className="btn sm" onClick={() => copyText(imei.imei).then(() => ctx.toast('הועתק'))}>העתק</button>
              </div>
              <div className="row wrap-row" style={{ marginTop: 8 }}>
                <a className="btn sm" href={'https://www.imei.info/?imei=' + imei.imei} target="_blank" rel="noreferrer">בדיקת דגם ↗</a>
                <button className="btn sm" onClick={() => ctx.open({ t: 'edit', draft: { type: 'imei', fields: { imei: imei.imei } } })}>➕ שמירה במאגר</button>
              </div>
            </div>
          )}
          {res.devs.length > 0 && <>
            <div className="h2">🔑 מקשים והוראות</div>
            <div className="list">{res.devs.map((d) => (
              <button key={d.list + d.id} className="card dv-row" onClick={() => ctx.open({ t: 'dev', list: d.list, id: d.id })}>
                {d.pic ? <img className="dv-pic" src={d.pic} alt="" /> : <span className="dv-pic none">{d.list === 'keys' ? '📱' : '🎵'}</span>}
                <span className="grow" style={{ minWidth: 0 }}><b>{d.name}</b><div className="muted small dv-note">{d.list === 'keys' ? (d.info?.note || 'מקש לגירסה') : [d.info?.body && '📝 הוראות', d.info?.video && '🎬 סרטון'].filter(Boolean).join(' · ') || 'גרסאות סמוויקס · עוד אין הוראות'}</div></span>
                {d.list === 'keys' && <span className={'dv-key' + (d.info?.key ? ' has' : '')}>{d.info?.key || '+ מקש'}</span>}
              </button>
            ))}</div>
          </>}
          {res.products.length > 0 && <>
            <div className="h2">🏷️ מוצרים</div>
            <div className="list">{res.products.map((p) => {
              const s = ctx.stock.find((x) => x.status !== 'arrived' && norm(x.name) === norm(p.name));
              return (
                <div key={p.id} className="card srow">
                  <div className="top2"><span className="e">🏷️</span>
                    <div className="grow"><b>{p.name}</b><div className="muted small">{[coName(p.company_id), p.barcode].filter(Boolean).join(' · ')}</div></div>
                    {p.price !== null && p.price !== undefined && <b className="price">{ils(p.price)}</b>}
                  </div>
                  <div className="row wrap-row">
                    {s ? <span className={'pill ' + stockSt(s.status, ctx.shop).cls}>{stockSt(s.status, ctx.shop).label}</span> : null}
                    <span className="grow" />
                    <button className="btn sm" onClick={() => ctx.open({ t: 'report', name: p.name, company_id: p.company_id })}>📦 דיווח חסר</button>
                    <button className="btn sm" onClick={() => ctx.open({ t: 'settings', view: 'products', edit: p })}>✏️</button>
                  </div>
                </div>
              );
            })}</div>
          </>}
          {res.cats.length > 0 && <><div className="h2">קטגוריות</div><div className="cats">{res.cats.map((c) => (
            <button key={c.id} className="cat" onClick={() => ctx.open({ t: 'cat', id: c.id })}><span className="e">{c.emoji || '🗂️'}</span><span className="g"><b>{c.name}</b><span className="n">{catCount(c) === 1 ? 'פריט אחד' : catCount(c) + ' פריטים'}</span></span></button>
          ))}</div></>}
          {res.cos.length > 0 && <><div className="h2">חברות</div><div className="cos">{res.cos.map((c) => (
            <button key={c.id} className="co" onClick={() => ctx.open({ t: 'co', id: c.id })}><CoLogo co={c} /><b>{c.name}</b></button>
          ))}</div></>}
          {res.info.length > 0 && <><div className="h2">📝 מידע ({res.info.length})</div>{res.info.slice(0, limit).map((it) => <ItemRow key={it.id} it={it} ctx={ctx} words={words} />)}</>}
          {res.info.length > limit && <button className="btn block" onClick={() => setLimit((l) => l + 100)}>עוד {res.info.length - limit}…</button>}
          {res.notes.length > 0 && <><div className="h2">📌 פתוחים</div><div className="list">{res.notes.map((x) => (
            <button key={x.id} className="card it" onClick={() => ctx.setTab('notes')}><div className="ic">{noteKind(x.kind).e}</div><div className="grow"><div className="t">{x.title}</div><div className="s">{x.author_name}</div></div><span className={'pill ' + NOTE_ST[x.status].cls}>{NOTE_ST[x.status].label}</span></button>
          ))}</div></>}
          {res.stock.length > 0 && <><div className="h2">📦 מלאי</div><div className="list">{res.stock.map((x) => (
            <button key={x.id} className="card it" onClick={() => ctx.setTab('stock')}><div className="ic">📦</div><div className="grow"><div className="t">{x.name}</div><div className="s">{coName(x.company_id)}</div></div><span className={'pill ' + stockSt(x.status, ctx.shop).cls}>{stockSt(x.status, ctx.shop).label}</span></button>
          ))}</div></>}
          {none && (
            <div className="empty">
              <div className="e">🤷</div>
              <div>לא נמצא "{qq}"</div>
              <div className="muted small">החיפוש נרשם, כדי שיוסיפו את המידע</div>
              <div className="row wrap-row" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn primary" onClick={() => ctx.open({ t: 'ask-new', kind: 'general', text: qq })}>💬 לשאול את הצוות</button>
                <button className="btn" onClick={() => ctx.open({ t: 'edit', draft: { title: qq } })}>➕ להוסיף כמידע</button>
                <button className="btn" onClick={() => ctx.open({ t: 'report', name: qq })}>📦 לדווח שחסר</button>
                {/^\d{8,14}$/.test(qq) && <button className="btn" onClick={() => ctx.open({ t: 'settings', view: 'products', edit: { barcode: qq } })}>🏷️ מוצר חדש עם הברקוד</button>}
                <button className="btn soft" onClick={() => ctx.open({ t: 'ask', q: qq })}>✨ לשאול את המאגר</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
