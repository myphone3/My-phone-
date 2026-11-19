'use client';
import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import CoLogo from '@/components/CoLogo';
import { SeenLine } from '@/components/Seen';
import { api, errText } from '@/lib/api';
import { STOCK_ST, stockSt, norm, timeAgo, waHref } from '@/lib/kb';

const OPEN = ['out', 'low'];

export default function StockTab({ ctx }) {
  const [f, setF] = useState('open');
  const list = useMemo(() => ctx.stock.filter((x) => (f === 'open' ? OPEN.includes(x.status) : f === 'ordered' ? x.status === 'ordered' : x.status === 'arrived'))
    .sort((a, b) => OPEN.indexOf(a.status) - OPEN.indexOf(b.status) || new Date(b.updated_at) - new Date(a.updated_at)), [ctx.stock, f]);
  const cnt = (s) => ctx.stock.filter((x) => (s === 'open' ? OPEN.includes(x.status) : x.status === s)).length;
  useEffect(() => { ctx.markSeen('stock', ctx.stock.filter((x) => x.status !== 'arrived'), 'created_by'); }, [ctx.stock.length]); // eslint-disable-line

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
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary big" style={{ flex: 2 }} onClick={() => ctx.open({ t: 'report' })}>➕ דיווח חוסר</button>
        <button className="btn big" style={{ flex: 1 }} onClick={() => ctx.open({ t: 'supplier' })}>📤 לספק</button>
      </div>
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
            <div key={x.id} className="card srow">
              <div className="top2">
                {co ? <CoLogo co={co} size={32} /> : <span className="e">📦</span>}
                <div className="grow">
                  <b>{x.name}</b>
                  <div className="muted small">{[co?.name, `${x.created_by_name}, ${timeAgo(x.created_at)}`, x.note, x.status_by_name && x.status_by_name !== x.created_by_name && `${st.label}: ${x.status_by_name}`].filter(Boolean).join(' · ')}</div>
                </div>
                <span className={'pill ' + st.cls}>{st.label}</span>
              </div>
              <SeenLine ctx={ctx} refType="stock" row={x} authorId={x.created_by} title={x.name} />
              {x.status !== 'arrived' ? (
                <div className="row" style={{ gap: 8 }}>
                  {x.status !== 'ordered' && <button className="btn blue grow" onClick={() => set(x, 'ordered')}>🔵 {stockSt('ordered', ctx.shop).label === 'הוזמן' ? 'הזמנתי' : stockSt('ordered', ctx.shop).label}</button>}
                  <button className="btn ok grow" onClick={() => set(x, 'arrived')}>✓ {stockSt('arrived', ctx.shop).label} למלאי</button>
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
export function StockReport({ ctx, name: name0 = '', companyId, fromNote }) {
  const [name, setName] = useState(name0);
  const [status, setStatus] = useState('out');
  const [co, setCo] = useState(companyId || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pool = useMemo(() => [...new Set([...ctx.products.map((p) => p.name), ...ctx.stock.map((x) => x.name)])], [ctx.products, ctx.stock]);
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
      const r = await api.saveStock(ctx.shopId, { name: name.trim(), status, company_id: co, note: note.trim() });
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
      <label className="lbl">הערה (לא חובה)</label>
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: נשארו 2" />
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={send}>{busy ? 'שולח…' : 'שליחה'}</button>
      <div className="muted small center" style={{ marginTop: 6 }}>כל העובדים מקבלים התראה</div>
    </Sheet>
  );
}

// רשימת חוסרים לספק: לפי חברה, הודעה מוכנה לוואטסאפ
export function Supplier({ ctx }) {
  const open = ctx.stock.filter((x) => OPEN.includes(x.status));
  const groups = {};
  for (const x of open) (groups[x.company_id || ''] ||= []).push(x);
  const keys = Object.keys(groups).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1));
  const text = (list) => `שלום, אנחנו צריכים:\n${list.map((x) => `• ${x.name}${x.note ? ` (${x.note})` : ''}`).join('\n')}\nתודה, ${ctx.shop.name}`;
  async function ordered(list) {
    try { const r = await api.stockStatus(ctx.shopId, list.map((x) => x.id), 'ordered'); ctx.apply('stock', r); ctx.toast('סומן כהוזמן ✓'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>📤 רשימת חוסרים לספק</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <div className="muted small">כל מה שחסר, מחולק לפי חברה. שולחים לספק בלחיצה.</div>
      {!keys.length && <div className="empty"><div className="e">✅</div>אין חוסרים</div>}
      {keys.map((k) => {
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
