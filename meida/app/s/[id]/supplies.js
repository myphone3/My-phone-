'use client';
// מצרכי חנות: טישו, שתייה, כוסות... — נפרד לגמרי מהמלאי
import { useEffect, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText, uploadPhoto } from '@/lib/api';
import { shrink } from '@/lib/image';
import { timeAgo, waHref } from '@/lib/kb';

export const SUP_CATS = [
  { k: 'drink', t: '☕ שתייה וכיבוד', tint: 'var(--sup-t2)' },
  { k: 'clean', t: '🧽 ניקיון', tint: 'var(--sup-t1)' },
  { k: 'one', t: '🥤 חד-פעמי', tint: 'var(--sup-t3)' },
  { k: 'office', t: '🖊️ משרד', tint: 'var(--sup-t4)' },
  { k: 'other', t: '📦 אחר', tint: 'var(--sup-t5)' },
];
const catOf = (k) => SUP_CATS.find((c) => c.k === k) || SUP_CATS[4];
const ST = { ok: ['✓ יש', 'ok'], low: ['⚠ עומד להיגמר', 'low'], out: ['✕ נגמר', 'out'] };
const VIEW_KEY = 'kb-sup-view';
const NEXT = { list: 'small', small: 'big', big: 'list' };
const ICON = { list: '☰', small: '▦', big: '◼' };
const VIEW_NAME = { list: 'רשימה', small: 'קוביות קטנות', big: 'קוביות גדולות' };

// ציור אוטומטי לפי השם (כשאין תמונה)
const AUTO = [
  [/קפה|נס/, '☕'], [/תה/, '🍵'], [/סוכר|ממתיק|סוכרזית/, '🍬'], [/מים/, '💧'], [/חלב/, '🥛'], [/שתי|קולה|מיץ|בקבוק/, '🥤'],
  [/עוגי|ביסקוו|כיבוד|במבה|ביסלי|חטיף/, '🍪'], [/טישו|מגבת|טואלט|נייר/, '🧻'], [/זבל/, '🗑️'], [/סבון|מגבונ/, '🧼'],
  [/ניקוי|אקונומיקה|ספריי|כלים|נוזל/, '🧴'], [/ספוג|סמרטוט|מטלי/, '🧽'], [/מטאטא|מגב/, '🧹'], [/כוס/, '🥤'], [/כפי|מזלג|סכו/, '🥄'],
  [/צלח/, '🍽️'], [/שקי/, '🛍️'], [/קופה|גליל|קבלה/, '🧾'], [/עט|טוש|מרקר/, '🖊️'], [/סלוטייפ|דבק|סיכ|מהדק/, '📎'],
  [/דף|דפים|נייר מדפסת/, '📄'], [/סולל|בטרי/, '🔋'], [/נורה|תאורה/, '💡'], [/מפתח/, '🔑'],
];
export const autoEmoji = (name) => (AUTO.find(([r]) => r.test(name || '')) || [0, '📦'])[1];
const picOf = (x) => x.emoji || autoEmoji(x.name);

function Pic({ x, cls }) {
  return (
    <div className={'sup-pic ' + (cls || '')} style={{ background: catOf(x.cat).tint }}>
      {x.photo ? <img src={x.photo} alt="" loading="lazy" /> : picOf(x)}
    </div>
  );
}

export const supNeed = (list) => (list || []).filter((x) => x.status !== 'ok').sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || new Date(b.status_at) - new Date(a.status_at));

export default function SuppliesTab({ ctx }) {
  const list = ctx.supplies;
  const [cat, setCat] = useState('all');
  const [view, setView0] = useState('list');
  useEffect(() => { try { const v = localStorage.getItem(VIEW_KEY); if (NEXT[v]) setView0(v); } catch {} }, []);
  useEffect(() => { ctx.loadSupplies(); }, []); // eslint-disable-line
  const setView = () => { const v = NEXT[view]; setView0(v); try { localStorage.setItem(VIEW_KEY, v); } catch {} ctx.toast('תצוגה: ' + VIEW_NAME[v]); };
  if (!list) return <div className="empty"><div className="spin" style={{ margin: 'auto' }} /></div>;
  const need = supNeed(list);
  const ci = (x) => SUP_CATS.findIndex((c) => c.k === x.cat);
  const shown = list.filter((x) => cat === 'all' || x.cat === cat).sort((a, b) => ci(a) - ci(b));
  const cats = SUP_CATS.filter((c) => list.some((x) => x.cat === c.k));
  const pick = (x) => ctx.open({ t: 'supply', id: x.id });
  const add = <button className={view === 'list' ? 'sup-row add' : 'sup-tile add'} onClick={() => ctx.open({ t: 'supply-edit', cat: cat === 'all' ? '' : cat })}>➕ מוצר חדש</button>;
  return (
    <>
      <div className="row" style={{ marginBottom: 2 }}>
        <div className="muted grow">דברים שהחנות צריכה — לא קשור למלאי</div>
        <button className="sup-vbtn" onClick={setView} aria-label={'תצוגה: ' + VIEW_NAME[view]}>{ICON[view]}</button>
      </div>
      <div className="card pad sup-cart">
        {need.length ? (
          <>
            <div className="row"><span style={{ fontSize: 22 }}>🛒</span><b className="grow" style={{ fontSize: 17 }}>צריך לקנות</b><span className="sup-cnt">{need.length}</span></div>
            <div className="sup-need">
              {need.map((x) => <button key={x.id} className={'sup-nchip ' + x.status} onClick={() => pick(x)}><Pic x={x} cls="ic" />{x.name}</button>)}
            </div>
            <button className="btn primary big block" onClick={() => ctx.open({ t: 'supply-cart' })}>🛒 רשימת קנייה · שליחה למי שקונה</button>
          </>
        ) : <div className="sup-allgood">✅ יש הכל — לא חסר כלום</div>}
      </div>
      <div className="chips">
        <button className={'chip' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>הכל</button>
        {cats.map((c) => <button key={c.k} className={'chip' + (cat === c.k ? ' on' : '')} onClick={() => setCat(c.k)}>{c.t}</button>)}
      </div>
      {view === 'list' ? (
        <div className="sup-rows">
          {(cat === 'all' ? cats : cats.filter((c) => c.k === cat)).map((c) => {
            const g = shown.filter((x) => x.cat === c.k);
            if (!g.length) return null;
            return (
              <div key={c.k} className="sup-rows">
                <div className="sup-grp">{c.t}</div>
                {g.map((x) => (
                  <button key={x.id} className={'sup-row ' + x.status} onClick={() => pick(x)}>
                    <Pic x={x} />
                    <div className="grow"><b>{x.name}</b>{x.status !== 'ok' && x.status_by_name && <small>{x.status_by_name}, {timeAgo(x.status_at)}</small>}</div>
                    <span className={'sup-st ' + ST[x.status][1]}>{ST[x.status][0]}</span>
                  </button>
                ))}
              </div>
            );
          })}
          {add}
        </div>
      ) : (
        <div className={'sup-grid' + (view === 'small' ? ' small' : '')}>
          {shown.map((x) => (
            <button key={x.id} className={'sup-tile ' + x.status} onClick={() => pick(x)}>
              <Pic x={x} />
              <div className="nm">{x.name}</div>
              <div className={'sup-st ' + ST[x.status][1]}>{ST[x.status][0]}</div>
            </button>
          ))}
          {add}
        </div>
      )}
    </>
  );
}

// לחיצה על מוצר: מה המצב
export function SupplySheet({ ctx, id }) {
  const x = (ctx.supplies || []).find((y) => y.id === id);
  const [busy, setBusy] = useState(false);
  if (!x) return null;
  async function set(status) {
    if (busy) return;
    if (status === x.status) { ctx.close(); return; }
    setBusy(true);
    try {
      const r = await api.saveSupply(ctx.shopId, { id: x.id, status });
      ctx.applySupply(r);
      if (status !== 'ok') ctx.notify({ supply: r.id });
      ctx.toast(status === 'ok' ? `✓ ${x.name} — יש` : `${x.name} נוסף לרשימת הקנייה`);
      ctx.close();
    } catch (e) { ctx.toast(errText(e)); setBusy(false); }
  }
  async function del() {
    if (!confirm(`למחוק את "${x.name}" מהמצרכים?`)) return;
    try { await api.deleteSupply(ctx.shopId, x.id); ctx.removeSupply(x.id); ctx.close(); } catch (e) { ctx.toast(errText(e)); }
  }
  return (
    <Sheet onClose={ctx.close}>
      <div className="sup-shtop">
        <Pic x={x} cls="lg" />
        <div className="grow"><b style={{ fontSize: 20 }}>{x.name}</b>
          <div className="muted">{x.status !== 'ok' && x.status_by_name ? `${ST[x.status][0].slice(2)} · ${x.status_by_name}, ${timeAgo(x.status_at)}` : 'מה המצב?'}</div></div>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        <button className={'sup-opt ok' + (x.status === 'ok' ? ' sel' : '')} disabled={busy} onClick={() => set('ok')}><span>✅</span>יש מספיק</button>
        <button className={'sup-opt low' + (x.status === 'low' ? ' sel' : '')} disabled={busy} onClick={() => set('low')}><span>⚠️</span>עומד להיגמר</button>
        <button className={'sup-opt out' + (x.status === 'out' ? ' sel' : '')} disabled={busy} onClick={() => set('out')}><span>❌</span>נגמר</button>
        <div className="row">
          <button className="btn sm grow" onClick={() => ctx.replace({ t: 'supply-edit', id: x.id })}>✏️ עריכה / תמונה</button>
          <button className="btn sm" onClick={del} aria-label="מחיקה">🗑️</button>
        </div>
      </div>
    </Sheet>
  );
}

// הוספה / עריכה: תמונה, שם, קטגוריה
export function SupplyEdit({ ctx, id, cat: cat0 }) {
  const x = id ? (ctx.supplies || []).find((y) => y.id === id) : null;
  const [name, setName] = useState(x?.name || '');
  const [cat, setCat] = useState(x?.cat || cat0 || 'drink');
  const [photo, setPhoto] = useState(x?.photo || '');
  const [up, setUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  async function onFile(e) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    setUp(true);
    try { setPhoto(await uploadPhoto(await shrink(f, 600, '#ffffff'))); } catch (er) { ctx.toast(errText(er)); }
    setUp(false);
  }
  async function save() {
    const nm = name.trim();
    if (!nm) { ctx.toast('צריך שם למוצר'); return; }
    setBusy(true);
    try {
      const r = await api.saveSupply(ctx.shopId, { ...(x ? { id: x.id } : {}), name: nm, cat, photo, emoji: autoEmoji(nm) });
      ctx.applySupply(r);
      ctx.toast(x ? '✓ נשמר' : `✓ ${nm} נוסף`);
      ctx.close();
    } catch (e) { ctx.toast(errText(e)); setBusy(false); }
  }
  const prev = { name: name || '?', cat, photo, emoji: autoEmoji(name) };
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>{x ? '✏️ עריכת מוצר' : '➕ מוצר חדש'}</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="row" style={{ gap: 12 }}>
        <button className="sup-photo" onClick={() => fileRef.current?.click()} disabled={up}>
          <Pic x={prev} cls="lg" />
          <span>{up ? 'מעלה…' : photo ? '📷 החלפה' : '📷 תמונה'}</span>
        </button>
        <div className="grow" style={{ display: 'grid', gap: 6 }}>
          <input className="input" placeholder="שם המוצר (למשל: מגבונים)" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus={!x} />
          {photo ? <button className="btn sm" onClick={() => setPhoto('')}>הסרת התמונה</button> : <div className="muted small">אין תמונה? יופיע ציור לפי השם.</div>}
        </div>
      </div>
      <div className="chips wrapped" style={{ marginTop: 10 }}>
        {SUP_CATS.map((c) => <button key={c.k} className={'chip' + (cat === c.k ? ' on' : '')} onClick={() => setCat(c.k)}>{c.t}</button>)}
      </div>
      <button className="btn primary big block" style={{ marginTop: 12 }} disabled={busy || up} onClick={save}>{busy ? 'שומר…' : 'שמירה'}</button>
    </Sheet>
  );
}

// רשימת קנייה: "קניתי" + שליחה בוואטסאפ
export function SupplyCart({ ctx }) {
  const need = supNeed(ctx.supplies);
  const [busy, setBusy] = useState('');
  const text = need.map((x) => `• ${x.name}${x.status === 'low' ? ' (עומד להיגמר)' : ''}`).join('\n');
  async function bought(list) {
    if (busy) return;
    setBusy(list.length > 1 ? 'all' : list[0].id);
    try {
      for (const x of list) ctx.applySupply(await api.saveSupply(ctx.shopId, { id: x.id, status: 'ok' }));
      ctx.toast(list.length > 1 ? '✓ הכל נקנה' : `✓ ${list[0].name} נקנה`);
    } catch (e) { ctx.toast(errText(e)); }
    setBusy('');
  }
  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>🛒 רשימת קנייה</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {!need.length && <div className="empty"><div className="e">✅</div>יש הכל — לא חסר כלום</div>}
      <div className="sup-rows">
        {need.map((x) => (
          <div key={x.id} className="sup-row static">
            <Pic x={x} />
            <div className="grow"><b>{x.name}</b><small>{x.status === 'out' ? 'נגמר' : 'עומד להיגמר'}{x.status_by_name ? ` · ${x.status_by_name}, ${timeAgo(x.status_at)}` : ''}</small></div>
            <button className="btn ok sm" disabled={!!busy} onClick={() => bought([x])}>{busy === x.id ? '…' : '✓ קניתי'}</button>
          </div>
        ))}
      </div>
      {need.length > 0 && (
        <>
          <div className="muted small" style={{ marginTop: 12 }}>ההודעה שתישלח:</div>
          <div className="preview-msg" style={{ marginTop: 4 }}>{text}</div>
          <div className="row wrap-row" style={{ marginTop: 10 }}>
            <a className="btn primary grow" href={waHref(text)} target="_blank" rel="noreferrer">💬 שליחה בוואטסאפ</a>
            {need.length > 1 && <button className="btn" disabled={!!busy} onClick={() => bought(need)}>✓ קניתי הכל</button>}
          </div>
        </>
      )}
    </Sheet>
  );
}
