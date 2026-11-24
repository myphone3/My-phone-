'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import CoLogo from '@/components/CoLogo';
import { SeenLine } from '@/components/Seen';
import { api, errText } from '@/lib/api';
import { STOCK_ST, LAB_PARTS, labPart, stockSt, norm, timeAgo, waHref } from '@/lib/kb';

const OPEN = ['out', 'low'];
const placeOf = (x) => (x.place === 'lab' ? 'lab' : 'shop');
const qtyTxt = (x) => (x.qty ? ` — כמות: ${x.qty}` : '');
const PLACE_KEY = 'kb-stock-place';
export const FOCUS_KEY = 'kb-stock-focus';
const dayMs = 86400000;

// כמות — לא חובה. לוחצים "הוספת כמות" ומופיע + / −
function QtyPicker({ qty, setQty }) {
  if (!qty) return <button className="btn dashed" onClick={() => setQty(1)}>➕ הוספת כמות</button>;
  return (
    <div className="stepper">
      <button className="btn" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="פחות">−</button>
      <b>{qty}</b>
      <button className="btn" onClick={() => setQty(Math.min(999, qty + 1))} aria-label="יותר">+</button>
      <button className="btn sm" style={{ marginInlineStart: 6 }} onClick={() => setQty(null)}>בלי כמות</button>
    </div>
  );
}

export default function StockTab({ ctx }) {
  const [f, setF] = useState('open');
  const [place, setPlace0] = useState('lab');
  const [part, setPart] = useState('');
  useEffect(() => { try { const v = localStorage.getItem(PLACE_KEY); if (v === 'shop' || v === 'lab') setPlace0(v); } catch {} }, []);
  const setPlace = (v) => { setPlace0(v); setPart(''); try { localStorage.setItem(PLACE_KEY, v); } catch {} };
  const lab = place === 'lab';
  const mine = useMemo(() => ctx.stock.filter((x) => placeOf(x) === place), [ctx.stock, place]);
  const inF = (x) => (f === 'open' ? OPEN.includes(x.status) : f === 'ordered' ? x.status === 'ordered' : x.status === 'arrived');
  const list = useMemo(() => mine.filter((x) => inF(x) && (!lab || !part || x.part === part))
    .sort((a, b) => OPEN.indexOf(a.status) - OPEN.indexOf(b.status) || new Date(b.updated_at) - new Date(a.updated_at)), [mine, f, part]); // eslint-disable-line
  const cnt = (s) => mine.filter((x) => (s === 'open' ? OPEN.includes(x.status) : x.status === s)).length;
  const openIn = (p) => ctx.stock.filter((x) => placeOf(x) === p && OPEN.includes(x.status)).length;
  useEffect(() => { ctx.markSeen('stock', ctx.stock.filter((x) => x.status !== 'arrived'), 'created_by'); }, [ctx.stock.length]); // eslint-disable-line
  // נפתח מהתראה: עוברים לפריט ומדגישים אותו
  const [hl, setHl] = useState('');
  const stockRef = useRef(ctx.stock); stockRef.current = ctx.stock;
  useEffect(() => {
    const go = () => {
      let id = ''; try { id = sessionStorage.getItem(FOCUS_KEY) || ''; } catch {}
      const x = id && stockRef.current.find((y) => y.id === id);
      if (!x) return;
      try { sessionStorage.removeItem(FOCUS_KEY); } catch {}
      setPlace0(placeOf(x)); setPart('');
      setF(OPEN.includes(x.status) ? 'open' : x.status === 'ordered' ? 'ordered' : 'arrived');
      setHl(id);
      setTimeout(() => document.getElementById('st-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
      setTimeout(() => setHl(''), 4000);
    };
    go();
    window.addEventListener(FOCUS_KEY, go);
    return () => window.removeEventListener(FOCUS_KEY, go);
  }, []); // eslint-disable-line

  async function set(x, status) {
    try { const r = await api.saveStock(ctx.shopId, { id: x.id, status }); ctx.apply('stock', r); ctx.toast(status === 'arrived' ? 'סומן שהגיע ✓' : 'סומן שהוזמן'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  async function del(x) {
    if (!confirm(`למחוק את "${x.name}" מהרשימה?`)) return;
    try { await api.deleteStock(ctx.shopId, x.id); ctx.apply('stock', { ...x, deleted_at: new Date().toISOString() }); } catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <>
      <div className="where">
        {[['lab', '🔧 מעבדה'], ['shop', '🏪 חנות']].map(([k, t]) => (
          <button key={k} className={(place === k ? 'on ' : '') + k} onClick={() => setPlace(k)}>{t}{openIn(k) > 0 && <span className="n">{openIn(k)}</span>}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary big" style={{ flex: 2 }} onClick={() => ctx.open({ t: 'report', place })}>➕ {lab ? 'חסר למעבדה' : 'דיווח חוסר'}</button>
        <button className="btn big" style={{ flex: 1 }} onClick={() => ctx.open({ t: 'supplier', place })}>📤 לספק</button>
      </div>
      <button className="btn sm block" style={{ marginTop: 8 }} onClick={() => ctx.open({ t: 'month' })}>📊 סיכום חודשי</button>
      {lab && (
        <div className="chips" style={{ paddingBottom: 0 }}>
          <button className={'chip' + (!part ? ' on' : '')} onClick={() => setPart('')}>הכל</button>
          {LAB_PARTS.map((p) => { const n = mine.filter((x) => x.part === p.k && inF(x)).length; return <button key={p.k} className={'chip' + (part === p.k ? ' on' : '')} onClick={() => setPart(part === p.k ? '' : p.k)}>{p.e} {p.many}{n > 0 && <span className="n"> {n}</span>}</button>; })}
        </div>
      )}
      <div className="seg" style={{ marginTop: 10 }}>
        <button className={f === 'open' ? 'on' : ''} onClick={() => setF('open')}>חסר ({cnt('open')})</button>
        <button className={f === 'ordered' ? 'on' : ''} onClick={() => setF('ordered')}>{stockSt('ordered', ctx.shop).label} ({cnt('ordered')})</button>
        <button className={f === 'arrived' ? 'on' : ''} onClick={() => setF('arrived')}>{stockSt('arrived', ctx.shop).label} ({cnt('arrived')})</button>
      </div>
      <div className="list" style={{ marginTop: 10 }}>
        {!list.length && <div className="empty"><div className="e">✅</div>{f === 'open' ? 'שום דבר לא חסר' : 'אין כאן כלום'}</div>}
        {list.map((x) => {
          const st = stockSt(x.status, ctx.shop);
          const co = ctx.tagsById[x.company_id];
          return (
            <div key={x.id} id={'st-' + x.id} className={'card srow' + (hl === x.id ? ' hl' : '')}>
              <div className="top2">
                {placeOf(x) === 'lab' ? <span className="e">{labPart(x.part).e}</span> : co ? <CoLogo co={co} size={32} /> : <span className="e">📦</span>}
                <div className="grow">
                  <b>{x.name}</b>{x.qty ? <span className="qty">{x.qty} יח׳</span> : null}
                  <div className="muted small">{[co?.name, `${x.created_by_name}, ${timeAgo(x.created_at)}`, x.note, x.status === 'arrived' && x.supplier && `הגיע מ: ${x.supplier}`, x.status_by_name && x.status_by_name !== x.created_by_name && `${st.label}: ${x.status_by_name}`].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={'pill ' + st.cls}>{st.label}</span>
              </div>
              <SeenLine ctx={ctx} refType="stock" row={x} authorId={x.created_by} title={x.name} />
              {x.status !== 'arrived' ? (
                <div className="row" style={{ gap: 8 }}>
                  {x.status !== 'ordered' && <button className="btn blue grow" onClick={() => set(x, 'ordered')}>🔵 {stockSt('ordered', ctx.shop).label === 'הוזמן' ? 'הזמנתי' : stockSt('ordered', ctx.shop).label}</button>}
                  <button className="btn ok grow" onClick={() => ctx.open({ t: 'arrive', id: x.id })}>✓ {stockSt('arrived', ctx.shop).label} למלאי</button>
                  {(x.created_by === ctx.me || ctx.isAdmin) && <button className="btn" onClick={() => del(x)} aria-label="מחיקה">🗑️</button>}
                </div>
              ) : <div className="row"><button className="btn sm" onClick={() => set(x, 'out')}>↩ שוב חסר</button></div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// דיווח: איזה מוצר + מה המצב + חברה. כל העובדים מקבלים התראה.
// בלי place קבוע (קיצור מהבית וכו׳) — בורר מעבדה / חנות בראש החלון.
export function StockReport(props) {
  const fixed = props.place === 'lab' || props.place === 'shop';
  const product = !!(props.name || props.companyId || props.fromNote);
  const [place, setPlace0] = useState(fixed ? props.place : 'shop');
  useEffect(() => {
    if (fixed || product) return;
    try { const v = localStorage.getItem(PLACE_KEY); if (v === 'shop' || v === 'lab') setPlace0(v); } catch {}
  }, []); // eslint-disable-line
  const setPlace = (v) => { setPlace0(v); try { localStorage.setItem(PLACE_KEY, v); } catch {} };
  const where = fixed ? null : (
    <div className="where">
      {[['lab', '🔧 מעבדה'], ['shop', '🏪 חנות']].map(([k, t]) => (
        <button key={k} className={(place === k ? 'on ' : '') + k} onClick={() => setPlace(k)}>{t}</button>
      ))}
    </div>
  );
  const again = product ? null : <AgainChips ctx={props.ctx} place={place} />;
  return place === 'lab' ? <LabReport ctx={props.ctx} where={where} again={again} /> : <ShopReport {...props} where={where} again={again} />;
}

// "היה חסר לאחרונה": מה שהגיע ב-30 הימים האחרונים ולא חסר עכשיו — לחיצה אחת מחזירה לרשימה
function AgainChips({ ctx, place }) {
  const [busy, setBusy] = useState('');
  const list = useMemo(() => {
    const open = new Set(ctx.stock.filter((x) => placeOf(x) === place && x.status !== 'arrived' && !x.deleted_at).map((x) => norm(x.name)));
    const seen = new Set(); const out = [];
    for (const x of [...ctx.stock].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))) {
      const k = norm(x.name);
      if (placeOf(x) !== place || x.status !== 'arrived' || x.deleted_at || open.has(k) || seen.has(k)) continue;
      seen.add(k); out.push(x);
      if (out.length >= 6) break;
    }
    return out;
  }, [ctx.stock, place]);
  if (!list.length) return null;
  async function again(x) {
    if (busy) return;
    setBusy(x.id);
    try {
      const r = await api.saveStock(ctx.shopId, { name: x.name, place: placeOf(x), part: x.part, company_id: x.company_id || '', status: 'out' });
      ctx.apply('stock', r);
      ctx.notify({ stock: r.id });
      ctx.toast(`✓ ${x.name} — חזר לחסר`);
      ctx.close();
    } catch (e) { ctx.toast(errText(e)); setBusy(''); }
  }
  return (
    <div className="again-box">
      <b>↩ היה חסר לאחרונה</b>
      <div className="small">לחיצה אחת — וזה חוזר לרשימת החוסרים</div>
      <div className="chips wrapped" style={{ paddingTop: 4 }}>
        {list.map((x) => <button key={x.id} className="chip again" disabled={!!busy} onClick={() => again(x)}>{placeOf(x) === 'lab' ? labPart(x.part).e : '📦'} {busy === x.id ? 'שולח…' : x.name}</button>)}
      </div>
    </div>
  );
}

// "הגיע" — עם ספק (לא חובה). הספקים נשמרים לבד.
let suppliersCache = null;
export function ArriveSheet({ ctx, id, already }) {
  const x = ctx.stock.find((y) => y.id === id);
  const [list, setList] = useState(suppliersCache || []);
  const [pick, setPick] = useState(x?.supplier || '');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.stockSuppliers(ctx.shopId).then((l) => { suppliersCache = l || []; setList(suppliersCache); }).catch(() => {});
  }, []); // eslint-disable-line
  if (!x) return null;
  const all = [...new Set([...list, ...(pick ? [pick] : [])])];
  async function save(supplier) {
    setBusy(true);
    try {
      const r = await api.saveStock(ctx.shopId, { id: x.id, status: 'arrived', supplier: supplier.trim() });
      ctx.apply('stock', r);
      if (supplier.trim() && !list.includes(supplier.trim())) suppliersCache = [supplier.trim(), ...list];
      ctx.toast(supplier.trim() ? `סומן שהגיע מ${supplier.trim()} ✓` : 'סומן שהגיע ✓');
      ctx.close();
    } catch (e) { ctx.toast(errText(e)); setBusy(false); }
  }
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>✓ {already ? 'סומן שהגיע' : 'הגיע'}: {x.name}</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <label className="lbl">מאיזה ספק הגיע? (לא חובה)</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {all.map((n) => <button key={n} className={'chip big' + (pick === n ? ' on' : '')} onClick={() => setPick(pick === n ? '' : n)}>{n}</button>)}
        {!adding && <button className="chip big add" onClick={() => setAdding(true)}>+ ספק חדש</button>}
      </div>
      {adding && <input className="input" style={{ marginTop: 8 }} autoFocus value={pick} onChange={(e) => setPick(e.target.value)} placeholder="שם הספק" maxLength={80} />}
      <div className="muted small" style={{ marginTop: 8 }}>הספקים נשמרים לבד — בפעם הבאה הם כבר מופיעים כאן.</div>
      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <button className="btn primary big" style={{ flex: 2 }} disabled={busy} onClick={() => save(pick)}>{busy ? 'שומר…' : 'שמירה'}</button>
        <button className="btn big" style={{ flex: 1 }} disabled={busy} onClick={() => (already && !x.supplier ? ctx.close() : save(''))}>בלי ספק</button>
      </div>
    </Sheet>
  );
}

// סיכום חודשי: כמה חסר, מה הכי הרבה, ולפי ספק — כמה הגיע ותוך כמה ימים
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
export function MonthSheet({ ctx }) {
  const [off, setOff] = useState(0);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + off, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + off + 1, 1);
  const req = useRef(0);
  useEffect(() => {
    const n = ++req.current; setRows(null); setErr('');
    api.stockRange(ctx.shopId, from.toISOString(), to.toISOString())
      .then((r) => { if (n === req.current) setRows(r || []); })
      .catch((e) => { if (n === req.current) setErr(errText(e)); });
  }, [off]); // eslint-disable-line
  const s = useMemo(() => {
    if (!rows) return null;
    const inM = (d) => d && new Date(d) >= from && new Date(d) < to;
    const rep = rows.filter((x) => inM(x.created_at));
    const top = {};
    for (const x of rep) { const k = placeOf(x) + '|' + norm(x.name); (top[k] ||= { x, n: 0 }).n++; }
    const tops = Object.values(top).sort((a, b) => b.n - a.n).slice(0, 6);
    const sup = {};
    for (const x of rows.filter((y) => y.status === 'arrived' && inM(y.arrived_at))) {
      const k = x.supplier || '';
      const g = (sup[k] ||= { name: k, n: 0, days: 0, dn: 0 });
      g.n++;
      const d = (new Date(x.arrived_at) - new Date(x.created_at)) / dayMs;
      if (d >= 0) { g.days += d; g.dn++; }
    }
    const sups = Object.values(sup).sort((a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || b.n - a.n);
    return {
      total: rep.length, lab: rep.filter((x) => placeOf(x) === 'lab').length, shop: rep.filter((x) => placeOf(x) === 'shop').length,
      tops, max: tops[0]?.n || 1, sups, waiting: rep.filter((x) => x.status !== 'arrived').length,
    };
  }, [rows]); // eslint-disable-line
  const avg = (g) => { if (!g.dn) return ''; const d = Math.round(g.days / g.dn); return d < 1 ? ' · באותו יום' : d === 1 ? ' · ממוצע יום' : ` · ממוצע ${d} ימים`; };
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head">
        <button className="icon-btn" onClick={() => setOff(off - 1)} aria-label="חודש קודם">›</button>
        <h2 className="center">📊 {MONTHS[from.getMonth()]} {from.getFullYear()}</h2>
        <button className="icon-btn" disabled={off >= 0} onClick={() => setOff(off + 1)} aria-label="חודש הבא">‹</button>
        <button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button>
      </div>
      {err && <div className="err">{err}</div>}
      {!s && !err && <div className="empty">טוען…</div>}
      {s && (
        <>
          <div className="m-stats">
            <div className="card"><b>{s.total}</b><span>דיווחי חוסר</span></div>
            <div className="card lab"><b>{s.lab}</b><span>🔧 מעבדה</span></div>
            <div className="card shop"><b>{s.shop}</b><span>🏪 חנות</span></div>
          </div>
          {!s.total && !s.sups.length && <div className="empty"><div className="e">📭</div>לא היו דיווחים בחודש הזה</div>}
          {s.tops.length > 0 && (
            <div className="card pad" style={{ marginTop: 10 }}>
              <div className="m-h">הכי הרבה חסר</div>
              {s.tops.map(({ x, n }) => (
                <div key={x.id} className="m-row">
                  <span className="m-name">{placeOf(x) === 'lab' ? labPart(x.part).e : '📦'} {x.name}</span>
                  <div className="grow"><div className="m-bar" style={{ width: Math.round((n / s.max) * 100) + '%' }} /></div>
                  <b className="m-n">{n}</b>
                </div>
              ))}
              {s.tops[0].n > 1 && <div className="muted small" style={{ marginTop: 10 }}>💡 מה שחוזר הרבה — כדאי להחזיק במלאי מראש</div>}
            </div>
          )}
          {s.sups.length > 0 && (
            <div className="card pad" style={{ marginTop: 10 }}>
              <div className="m-h">מה הגיע — לפי ספק</div>
              {s.sups.map((g) => (
                <div key={g.name || '-'} className="m-row"><b className="grow">{g.name || 'בלי ספק'}</b><span className="muted">{g.n} הגיעו{avg(g)}</span></div>
              ))}
            </div>
          )}
          {s.waiting > 0 && <div className="card pad row" style={{ marginTop: 10 }}><span className="grow">⏳ דווחו החודש ועדיין לא הגיעו</span><b style={{ color: 'var(--amber)' }}>{s.waiting}</b></div>}
        </>
      )}
    </Sheet>
  );
}

// מעבדה: מה חסר (מסך / סוללה…) + לאיזה מכשיר + כמה. בלי תמונות, בלי חברה.
function LabReport({ ctx, where, again }) {
  const [part, setPart] = useState('screen');
  const [model, setModel] = useState('');
  const [qty, setQty] = useState(null);
  const [status, setStatus] = useState('out');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const P = labPart(part);
  // דגמים שכבר דווחו במעבדה — להשלמה מהירה
  const pool = useMemo(() => [...new Set(ctx.stock.filter((x) => placeOf(x) === 'lab' && labPart(x.part).pre).map((x) => x.name.replace(labPart(x.part).label, '').trim()).filter(Boolean))], [ctx.stock]);
  const w = norm(model);
  const sugg = P.pre && w ? pool.filter((n) => n && norm(n).includes(w) && norm(n) !== w).slice(0, 6) : [];
  async function send() {
    const m = model.trim();
    if (!m) { setErr(P.pre ? 'לאיזה מכשיר?' : 'מה בדיוק חסר?'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.saveStock(ctx.shopId, { name: P.pre ? `${P.label} ${m}` : m, place: 'lab', part, qty: qty || null, status, note: note.trim() });
      ctx.apply('stock', r);
      ctx.notify({ stock: r.id });
      ctx.toast('דווח ✓ כולם קיבלו התראה');
      ctx.close();
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>🔧 חסר למעבדה</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {where}
      {again}
      <label className="lbl">1 · מה חסר?</label>
      <div className="choices">
        {LAB_PARTS.map((p) => <button key={p.k} className={'choice' + (part === p.k ? ' on' : '')} onClick={() => setPart(p.k)}>{p.e} {p.label}</button>)}
      </div>
      <label className="lbl">2 · {P.pre ? 'לאיזה מכשיר?' : 'מה בדיוק?'}</label>
      <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder={P.pre ? 'למשל: Galaxy A14 / iPhone 11 / Nokia 105' : part === 'tool' ? 'למשל: דבק B-7000' : 'למשל: רמקול Galaxy A14'} />
      {sugg.length > 0 && <div className="chips wrapped">{sugg.map((n) => <button key={n} className="chip" onClick={() => setModel(n)}>{n}</button>)}</div>}
      <label className="lbl">כמות (לא חובה)</label>
      <QtyPicker qty={qty} setQty={setQty} />
      <label className="lbl">מה המצב?</label>
      <div className="choices">
        {STOCK_ST.filter((s) => s.k !== 'arrived').map((s0) => { const s = stockSt(s0.k, ctx.shop); return <button key={s.k} className={'choice' + (status === s.k ? ' on' : '')} onClick={() => setStatus(s.k)}>{s.e} {s.label}</button>; })}
      </div>
      <label className="lbl">הערה (לא חובה)</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: עם מסגרת, צבע שחור" />
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={send}>{busy ? 'שולח…' : 'שליחה'}</button>
      <div className="muted small center" style={{ marginTop: 6 }}>כל העובדים מקבלים התראה</div>
    </Sheet>
  );
}

function ShopReport({ ctx, name: name0 = '', companyId, fromNote, where, again }) {
  const [name, setName] = useState(name0);
  const [qty, setQty] = useState(null);
  const [status, setStatus] = useState('out');
  const [co, setCo] = useState(companyId || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pool = useMemo(() => [...new Set([...ctx.products.map((p) => p.name), ...ctx.stock.filter((x) => placeOf(x) === 'shop').map((x) => x.name)])], [ctx.products, ctx.stock]);
  const w = norm(name);
  const sugg = (w ? pool.filter((n) => norm(n).includes(w) && norm(n) !== w) : pool).slice(0, 6);
  const pick = (n) => {
    setName(n);
    const p = ctx.products.find((x) => x.name === n);
    if (p?.company_id && !co) setCo(p.company_id);
  };
  async function send() {
    if (!name.trim()) { setErr('איזה מוצר חסר?'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.saveStock(ctx.shopId, { name: name.trim(), status, company_id: co, qty: qty || null, note: note.trim() });
      ctx.apply('stock', r);
      ctx.notify({ stock: r.id });
      if (fromNote) { try { ctx.apply('notes', await api.noteSet(ctx.shopId, fromNote, 'done')); } catch {} }
      ctx.toast('דווח ✓ כולם קיבלו התראה');
      ctx.close();
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>📦 חסר במלאי</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {where}
      {again}
      <label className="lbl">1 · איזה מוצר?</label>
      <div className="row">
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: מטען 25W" autoFocus={!name0} />
        <button className="btn" onClick={() => ctx.open({ t: 'barcode', onPick: (code) => { const p = ctx.products.find((x) => x.barcode === code); if (p) pick(p.name); else setName(code); } })} aria-label="סריקה">📷</button>
      </div>
      {sugg.length > 0 && <div className="chips wrapped">{sugg.map((n) => <button key={n} className="chip" onClick={() => pick(n)}>{n}</button>)}</div>}
      <label className="lbl">2 · מה המצב?</label>
      <div className="choices">
        {STOCK_ST.filter((s) => s.k !== 'arrived').map((s0) => { const s = stockSt(s0.k, ctx.shop); return <button key={s.k} className={'choice' + (status === s.k ? ' on' : '')} onClick={() => setStatus(s.k)}>{s.e} {s.label}</button>; })}
      </div>
      <label className="lbl">חברה (לא חובה)</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {ctx.companies.map((c) => <button key={c.id} className={'chip' + (co === c.id ? ' on' : '')} onClick={() => setCo(co === c.id ? '' : c.id)}><CoLogo co={c} size={20} /> {c.name}</button>)}
        <button className="chip add" onClick={() => ctx.open({ t: 'settings', view: 'company' })}>+ חברה חדשה</button>
      </div>
      <label className="lbl">כמות (לא חובה)</label>
      <QtyPicker qty={qty} setQty={setQty} />
      <label className="lbl">הערה (לא חובה)</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: נשארו 2" />
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={send}>{busy ? 'שולח…' : 'שליחה'}</button>
      <div className="muted small center" style={{ marginTop: 6 }}>כל העובדים מקבלים התראה</div>
    </Sheet>
  );
}

// רשימת חוסרים לספק: לפי חברה, הודעה מוכנה לוואטסאפ
export function Supplier({ ctx, place = 'shop' }) {
  const lab = place === 'lab';
  const open = ctx.stock.filter((x) => placeOf(x) === place && OPEN.includes(x.status));
  const groups = {};
  if (lab) { for (const p of LAB_PARTS) { const l = open.filter((x) => labPart(x.part).k === p.k); if (l.length) groups[p.k] = l; } }
  else for (const x of open) (groups[x.company_id || ''] ||= []).push(x);
  const keys = lab ? Object.keys(groups) : Object.keys(groups).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1));
  const all = keys.flatMap((k) => groups[k]);
  // רק הרשימה עצמה — בלי שלום ותודה (את השאר בעל החנות כותב בעצמו)
  const text = (list) => list.map((x) => `• ${x.name}${qtyTxt(x)}${x.note ? ` (${x.note})` : ''}`).join('\n');
  async function ordered(list) {
    try { const r = await api.stockStatus(ctx.shopId, list.map((x) => x.id), 'ordered'); ctx.apply('stock', r); ctx.toast('סומן כהוזמן ✓'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>📤 {lab ? 'חלקים למעבדה — לספק' : 'רשימת חוסרים לספק'}</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <div className="muted small">{lab ? 'כל מה שחסר למעבדה בהודעה אחת. שולחים לספק החלקים בלחיצה.' : 'כל מה שחסר, מחולק לפי חברה. שולחים לספק בלחיצה.'}</div>
      {!keys.length && <div className="empty"><div className="e">✅</div>אין חוסרים</div>}
      {lab && all.length > 0 && (
        <div className="card pad" style={{ marginTop: 10 }}>
          <div className="row"><span>🔧</span><b className="grow">הכל למעבדה</b><span className="muted">{all.length}</span></div>
          <div className="preview-msg" style={{ marginTop: 8 }}>{text(all)}</div>
          <div className="row wrap-row" style={{ marginTop: 8 }}>
            <a className="btn sm primary" href={waHref(text(all))} target="_blank" rel="noreferrer">💬 שליחה בוואטסאפ</a>
            <button className="btn sm" onClick={() => ordered(all)}>🔵 סמן הכל כהוזמן</button>
          </div>
        </div>
      )}
      {!lab && keys.map((k) => {
        const co = ctx.tagsById[k];
        const list = groups[k];
        return (
          <div key={k || 'none'} className="card pad" style={{ marginTop: 10 }}>
            <div className="row">{co ? <CoLogo co={co} size={28} /> : <span>📦</span>}<b className="grow">{co ? co.name : 'בלי חברה'}</b><span className="muted">{list.length}</span></div>
            <div className="preview-msg" style={{ marginTop: 8 }}>{text(list)}</div>
            <div className="row wrap-row" style={{ marginTop: 8 }}>
              <a className="btn sm primary" href={waHref(text(list))} target="_blank" rel="noreferrer">💬 שליחה בוואטסאפ</a>
              <button className="btn sm" onClick={() => ordered(list)}>🔵 סמן הכל כהוזמן</button>
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
