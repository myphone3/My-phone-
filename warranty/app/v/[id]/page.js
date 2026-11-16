'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { rememberVault, forgetVault, getPref, setPref } from '@/lib/local';
import { status, matches, fmtDate, fmtPrice, catEmoji, CATEGORIES, expiryDate } from '@/lib/warranty';
import InstallButton from '@/components/InstallButton';
import Sheet from '@/components/Sheet';
import Editor from './editor';
import Detail from './detail';

const FILTERS = [
  { k: 'all', label: 'הכל' },
  { k: 'active', label: '🟢 באחריות' },
  { k: 'soon', label: '🟠 מסתיימת בקרוב' },
  { k: 'expired', label: '🔴 נגמרה' },
];
const SORTS = [
  { k: 'date', label: 'תאריך קנייה (חדש קודם)' },
  { k: 'expiry', label: 'סיום אחריות (קרוב קודם)' },
  { k: 'store', label: 'לפי חנות' },
  { k: 'added', label: 'נוסף לאחרונה' },
];

export default function VaultPage({ params }) {
  const id = params.id;
  const router = useRouter();
  const [vault, setVault] = useState(null);
  const [list, setList] = useState([]);
  const [state, setState] = useState('loading'); // loading | ok | missing | error
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('date');
  const [sheet, setSheet] = useState(null); // {t:'add'} | {t:'edit', r, files} | {t:'view', id} | {t:'menu'} | {t:'sort'}
  const [toast, setToast] = useState('');
  const fileCam = useRef(null);
  const fileGal = useRef(null);

  const say = useCallback((t) => { setToast(t); setTimeout(() => setToast(''), 2600); }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('wr_get_vault', { p_vault: id });
    if (error) return setState((s) => (s === 'ok' ? s : 'error'));
    if (!data) return setState('missing');
    setVault(data.vault);
    setList(data.receipts || []);
    rememberVault(id, data.vault.name);
    setState('ok');
  }, [id]);

  useEffect(() => { setSort(getPref('sort', 'date')); load(); }, [load]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const withStatus = useMemo(() => list.map((r) => ({ ...r, _s: status(r) })), [list]);
  const counts = useMemo(() => {
    const c = { active: 0, soon: 0, expired: 0 };
    withStatus.forEach((r) => { if (r._s.k === 'active') c.active++; else if (r._s.k === 'soon') { c.soon++; c.active++; } else if (r._s.k === 'expired') c.expired++; });
    return c;
  }, [withStatus]);
  const cats = useMemo(() => {
    const m = {};
    withStatus.forEach((r) => { if (r.category) m[r.category] = (m[r.category] || 0) + 1; });
    return CATEGORIES.filter((c) => m[c.k]).map((c) => ({ ...c, n: m[c.k] }));
  }, [withStatus]);

  const shown = useMemo(() => {
    let a = withStatus.filter((r) => matches(r, q));
    if (filter === 'active') a = a.filter((r) => r._s.k === 'active' || r._s.k === 'soon');
    else if (filter !== 'all') a = a.filter((r) => r._s.k === filter);
    if (cat) a = a.filter((r) => r.category === cat);
    const by = {
      date: (x, y) => (y.purchase_date || '').localeCompare(x.purchase_date || '') || y.created_at.localeCompare(x.created_at),
      added: (x, y) => y.created_at.localeCompare(x.created_at),
      store: (x, y) => (x.store || 'תתת').localeCompare(y.store || 'תתת', 'he') || (y.purchase_date || '').localeCompare(x.purchase_date || ''),
      expiry: (x, y) => {
        const ex = expiryDate(x), ey = expiryDate(y);
        const rank = (r, e) => (!e ? 3 : r._s.k === 'expired' ? 2 : 1);
        return rank(x, ex) - rank(y, ey) || (rank(x, ex) === 2 ? ey - ex : ex - ey) || 0;
      },
    };
    return a.sort(by[sort] || by.date);
  }, [withStatus, q, filter, cat, sort]);

  function pickFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 6);
    e.target.value = '';
    if (files.length) setSheet({ t: 'edit', r: null, files });
  }

  function saved(r, isNew) {
    setList((l) => (isNew ? [r, ...l] : l.map((x) => (x.id === r.id ? r : x))));
    setSheet(isNew ? null : { t: 'view', id: r.id });
    say(isNew ? '✅ הקבלה נשמרה' : '✅ עודכן');
  }

  async function remove(r) {
    if (!confirm(`למחוק את הקבלה של "${r.product || r.store || 'ללא שם'}"?`)) return;
    const { error } = await supabase.rpc('wr_delete_receipt', { p_vault: id, p_id: r.id });
    if (error) return say('המחיקה נכשלה, נסה שוב');
    setList((l) => l.filter((x) => x.id !== r.id));
    setSheet(null);
    say('🗑️ נמחק');
  }

  if (state === 'loading') return <div className="reading" style={{ paddingTop: 120 }}><div className="spin" /><div className="muted">טוען קבלות…</div></div>;
  if (state === 'missing' || state === 'error') {
    return (
      <div className="wrap empty" style={{ paddingTop: 80 }}>
        <div className="big">{state === 'missing' ? '🤷' : '📡'}</div>
        <h2>{state === 'missing' ? 'הארכיון לא נמצא' : 'אין חיבור'}</h2>
        <p>{state === 'missing' ? 'אולי הקישור לא הועתק עד הסוף.' : 'בדוק את האינטרנט ונסה שוב.'}</p>
        {state === 'missing'
          ? <button className="btn primary" onClick={() => { forgetVault(id); router.replace('/?all'); }}>למסך הראשי</button>
          : <button className="btn primary" onClick={() => { setState('loading'); load(); }}>נסה שוב</button>}
      </div>
    );
  }

  const viewing = sheet?.t === 'view' ? list.find((r) => r.id === sheet.id) : null;
  const soonList = withStatus.filter((r) => r._s.k === 'soon');

  return (
    <div className="wrap">
      <div className="top">
        <div className="row" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 28 }}>🧾</div>
          <div className="grow">
            <h1 className="title">{vault.name}</h1>
            <div className="muted small">{list.length ? `${list.length} קבלות` : 'עוד אין קבלות'}</div>
          </div>
          <button className="icon-btn" onClick={() => setSheet({ t: 'sort' })} aria-label="מיון">↕️</button>
          <button className="icon-btn" onClick={() => setSheet({ t: 'menu' })} aria-label="תפריט">☰</button>
        </div>
        {list.length > 0 && (
          <div className="search">
            <span>🔎</span>
            <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: מוצר, חנות, שנה…" />
            {q && <button onClick={() => setQ('')} aria-label="נקה">✕</button>}
          </div>
        )}
        {list.length > 0 && (
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.k} className={'chip' + (filter === f.k ? ' on' : '')} onClick={() => setFilter(f.k)}>
                {f.label}{f.k !== 'all' && <span className="n">{counts[f.k]}</span>}
              </button>
            ))}
          </div>
        )}
        {cats.length > 1 && (
          <div className="chips">
            {cats.map((c) => (
              <button key={c.k} className={'chip' + (cat === c.k ? ' on' : '')} onClick={() => setCat(cat === c.k ? '' : c.k)}>
                {c.e} {c.k}<span className="n">{c.n}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {soonList.length > 0 && filter === 'all' && !q && !cat && (
        <button className="alert" onClick={() => setFilter('soon')}>
          ⏰ {soonList.length === 1 ? `האחריות על "${soonList[0].product || soonList[0].store}" מסתיימת בעוד ${soonList[0]._s.days} ימים` : `ל-${soonList.length} מוצרים האחריות מסתיימת בחודש הקרוב`} — כדאי לבדוק שהכול תקין
        </button>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="big">📸</div>
          <h2 style={{ color: 'var(--ink)', margin: '8px 0' }}>מוסיפים את הקבלה הראשונה</h2>
          <p>לוחצים על <b>קבלה חדשה</b> למטה ומצלמים.<br />שם החנות, המוצר והתאריך ימולאו לבד.</p>
          <div style={{ maxWidth: 320, margin: '20px auto 0' }}><InstallButton /></div>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <div className="big">🔎</div>
          <p>לא נמצאו קבלות{q ? ` עבור "${q}"` : ''}</p>
          <button className="btn" onClick={() => { setQ(''); setFilter('all'); setCat(''); }}>הצג הכל</button>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {shown.map((r) => <Row key={r.id} r={r} onClick={() => setSheet({ t: 'view', id: r.id })} />)}
        </div>
      )}

      <button className="fab" onClick={() => setSheet({ t: 'add' })}>📸 קבלה חדשה</button>
      <input ref={fileCam} type="file" accept="image/*" capture="environment" hidden onChange={pickFiles} />
      <input ref={fileGal} type="file" accept="image/*" multiple hidden onChange={pickFiles} />

      {sheet?.t === 'add' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3>קבלה חדשה</h3>
          <div className="menu-list">
            <button onClick={() => fileCam.current.click()}><span className="ic">📷</span><span className="grow"><b>לצלם עכשיו</b><div className="muted small">הכי טוב: קבלה ישרה, באור טוב</div></span></button>
            <button onClick={() => fileGal.current.click()}><span className="ic">🖼️</span><span className="grow"><b>לבחור מהגלריה</b><div className="muted small">אפשר כמה תמונות: קבלה, תעודת אחריות, המוצר</div></span></button>
            <button onClick={() => setSheet({ t: 'edit', r: null, files: [] })}><span className="ic">✍️</span><span className="grow"><b>בלי תמונה</b><div className="muted small">רק לרשום את הפרטים</div></span></button>
          </div>
        </Sheet>
      )}
      {sheet?.t === 'edit' && (
        <Editor vaultId={id} initial={sheet.r} files={sheet.files} stores={[...new Set(list.map((r) => r.store).filter(Boolean))]}
          onClose={() => setSheet(sheet.r ? { t: 'view', id: sheet.r.id } : null)} onSaved={saved} say={say} />
      )}
      {viewing && (
        <Detail r={viewing} onClose={() => setSheet(null)} onEdit={() => setSheet({ t: 'edit', r: viewing, files: [] })} onDelete={() => remove(viewing)} say={say} />
      )}
      {sheet?.t === 'sort' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3>↕️ סידור</h3>
          <div className="menu-list">
            {SORTS.map((s) => (
              <button key={s.k} onClick={() => { setSort(s.k); setPref('sort', s.k); setSheet(null); }}>
                <span className="ic">{sort === s.k ? '✅' : '⚪'}</span><span className="grow">{s.label}</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet?.t === 'menu' && (
        <MenuSheet vault={vault} list={list} onClose={() => setSheet(null)} say={say}
          onRenamed={(n) => { setVault({ ...vault, name: n }); rememberVault(id, n); }}
          onLeave={() => { forgetVault(id); router.replace('/?all'); }} onAll={() => router.push('/?all')} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Row({ r, onClick }) {
  const s = r._s;
  return (
    <button className="card rc" onClick={onClick}>
      <div className="thumb">{r.photos?.[0] ? <img src={r.photos[0]} alt="" loading="lazy" /> : catEmoji(r.category)}</div>
      <div className="grow">
        <div className="rname">{r.product || r.store || 'קבלה ללא שם'}</div>
        <div className="meta">
          {r.product && r.store && <span>🏪 {r.store}</span>}
          {r.purchase_date && <span>📅 {fmtDate(r.purchase_date)}</span>}
          {r.price !== null && r.price !== undefined && <span>{fmtPrice(r.price)}</span>}
        </div>
        <span className={'badge s-' + s.k}>{s.k === 'active' || s.k === 'soon' ? '🛡️ ' : ''}{s.label}</span>
      </div>
    </button>
  );
}

function MenuSheet({ vault, list, onClose, onRenamed, onLeave, onAll, say }) {
  const [name, setName] = useState(vault.name);
  const link = typeof window !== 'undefined' ? `${location.origin}/v/${vault.id}` : '';

  async function rename() {
    const n = name.trim();
    if (!n || n === vault.name) return;
    const { error } = await supabase.rpc('wr_rename_vault', { p_vault: vault.id, p_name: n });
    if (error) return say('לא נשמר, נסה שוב');
    onRenamed(n); say('✅ השם עודכן');
  }
  async function copy() { try { await navigator.clipboard.writeText(link); say('🔗 הקישור הועתק'); } catch { prompt('העתק את הקישור:', link); } }
  function whatsapp() {
    const t = `הקבלות לאחריות שלנו 🧾\nכאן שומרים את כל הקבלות ורואים עד מתי האחריות:\n${link}`;
    location.href = 'https://wa.me/?text=' + encodeURIComponent(t);
  }
  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['מוצר', 'חנות', 'קטגוריה', 'תאריך קנייה', 'מחיר', 'אחריות (חודשים)', 'סיום אחריות', 'מספר סידורי', 'הערות', 'תמונות'];
    const rows = list.map((r) => { const e = expiryDate(r); return [r.product, r.store, r.category, r.purchase_date, r.price, r.warranty_months, e ? fmtDate(e) : '', r.serial, r.notes, (r.photos || []).join(' ')]; });
    const csv = '﻿' + [head, ...rows].map((x) => x.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'קבלות-אחריות.csv';
    a.click();
  }

  return (
    <Sheet onClose={onClose}>
      <h3>☰ תפריט</h3>
      <div className="field" style={{ marginTop: 0 }}>
        <label>שם הארכיון</label>
        <div className="row">
          <input className="input grow" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') rename(); }} />
          <button className="btn" onClick={rename} disabled={!name.trim() || name.trim() === vault.name}>שמור</button>
        </div>
      </div>
      <div className="sec">שיתוף עם המשפחה</div>
      <div className="muted small" style={{ margin: '0 4px 8px' }}>מי שמקבל את הקישור רואה ומוסיף קבלות. שלחו רק למי שאתם סומכים עליו.</div>
      <div className="grid2">
        <button className="btn" onClick={whatsapp}>💬 וואטסאפ</button>
        <button className="btn" onClick={copy}>🔗 העתק קישור</button>
      </div>
      <div className="sec">עוד</div>
      <div className="menu-list">
        <button onClick={exportCsv} disabled={!list.length}><span className="ic">📊</span><span className="grow">ייצוא לאקסל (גיבוי)</span></button>
        <button onClick={onAll}><span className="ic">🗂️</span><span className="grow">ארכיונים נוספים</span></button>
        <button onClick={() => { if (confirm('להסיר את הארכיון מהמכשיר הזה?\nהקבלות לא נמחקות — אפשר לחזור עם הקישור.')) onLeave(); }}><span className="ic">🚪</span><span className="grow">הסר מהמכשיר הזה</span></button>
      </div>
      <div style={{ marginTop: 12 }}><InstallButton /></div>
    </Sheet>
  );
}
