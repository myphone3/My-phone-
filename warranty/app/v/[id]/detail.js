'use client';
import { useRef, useState } from 'react';
import { rpc } from '@/lib/lock';
import { status, fmtDate, fmtPrice, monthsLabel, catEmoji, baseExpiry, isPdf } from '@/lib/warranty';
import Sheet from '@/components/Sheet';
import { FileTile, upload } from './editor';

const ICON = { active: '🛡️', soon: '⏰', expired: '⌛', none: '🧾', unknown: '❔' };
const tel = (p) => 'tel:' + String(p).replace(/[^\d*#+]/g, '');
// מספר נייד ישראלי → קישור וואטסאפ ישיר
const waNumber = (p) => { const d = String(p || '').replace(/\D/g, ''); return /^05\d{8}$/.test(d) ? '972' + d.slice(1) : /^9725\d{8}$/.test(d) ? d : ''; };

function summary(r, s) {
  return [
    `🧾 ${r.product || 'קבלה'}`,
    r.store && `חנות: ${r.store}`,
    r.purchase_date && `תאריך קנייה: ${fmtDate(r.purchase_date)}`,
    r.price !== null && r.price !== undefined && `מחיר: ${fmtPrice(r.price)}`,
    r.receipt_no && `מספר קבלה: ${r.receipt_no}`,
    r.serial && `מספר סידורי: ${r.serial}`,
    s.end && `אחריות עד: ${fmtDate(s.end)}`,
  ].filter(Boolean);
}

export default function Detail({ r, onClose, onEdit, onDelete, onSaved, say }) {
  const [view, setView] = useState(-1);
  const [prodBusy, setProdBusy] = useState(false);
  const prodRef = useRef(null);
  // כל התמונות לצפייה במסך מלא: קודם המוצר, אחר כך הקבלה (בלי PDF)
  const gallery = [r.product_photo, ...(r.photos || [])].filter((u) => u && !isPdf(u));
  const openImg = (u) => (isPdf(u) ? window.open(u, '_blank') : setView(gallery.indexOf(u)));

  // הוספת תמונת מוצר ישר מכאן, בלי לפתוח עריכה
  async function addProduct(file) {
    if (!file) return;
    setProdBusy(true);
    try {
      const url = await upload(r.vault_id, file, true);
      const p = { ...r, product_photo: url };
      for (const k of ['price', 'warranty_months', 'ext_months', 'ext_price']) p[k] = p[k] === null || p[k] === undefined ? '' : String(p[k]);
      const { data, error } = await rpc('wr_save_receipt', r.vault_id, { p });
      if (error) throw error;
      onSaved?.(data); say('📦 תמונת המוצר נשמרה');
    } catch { say('התמונה לא נשמרה, נסה שוב'); }
    setProdBusy(false);
  }
  const [broken, setBroken] = useState(false);
  const s = status(r);
  const base = baseExpiry(r);
  const total = s.end && r.purchase_date ? Math.max(1, (s.end - new Date(r.purchase_date)) / 86400000) : 1;
  const pct = s.days !== undefined ? Math.max(0, Math.min(100, (s.days / total) * 100)) : 0;

  async function share() {
    const lines = summary(r, s);
    try {
      const first = r.photos?.[0];
      if (first && navigator.canShare) {
        const blob = await (await fetch(first)).blob();
        const file = new File([blob], isPdf(first) ? 'receipt.pdf' : 'receipt.jpg', { type: blob.type });
        if (navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text: lines.join('\n') });
      }
      if (navigator.share) return await navigator.share({ text: lines.concat(r.photos || []).join('\n') });
    } catch (e) { if (e?.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(lines.concat(r.photos || []).join('\n')); say('📋 הפרטים הועתקו'); } catch {}
  }

  return (
    <>
      <Sheet onClose={onClose}>
        <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
          <div className="grow">
            <h3 style={{ margin: 0 }}>{r.product || r.store || 'קבלה'}</h3>
            {r.product && r.store && <div className="muted">🏪 {r.store}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="סגור">✕</button>
        </div>

        {r.product_photo ? (
          <button style={{ width: '100%' }} onClick={() => openImg(r.product_photo)}><img className="hero prod" src={r.product_photo} alt={r.product || 'המוצר'} /></button>
        ) : (
          <button className="addprod" onClick={() => prodRef.current.click()} disabled={prodBusy}>
            {prodBusy ? <div className="spin" style={{ width: 30, height: 30 }} /> : <><span style={{ fontSize: 34 }}>📦</span><b>הוסף תמונה של המוצר</b><span className="muted small">כדי לזהות אותו בקלות ברשימה</span></>}
          </button>
        )}
        <input ref={prodRef} type="file" accept="image/*" hidden onChange={(e) => { addProduct(e.target.files?.[0]); e.target.value = ''; }} />

        {r.photos?.length > 0 && (
          <>
            <div className="sec">🧾 הקבלה</div>
            {isPdf(r.photos[0])
              ? <a className="btn block" style={{ height: 64, fontSize: 17 }} href={r.photos[0]} target="_blank" rel="noreferrer">📄 פתח את הקבלה (PDF)</a>
              : <button style={{ width: '100%' }} onClick={() => openImg(r.photos[0])}><img className="hero rcpt" src={r.photos[0]} alt="הקבלה" /></button>}
            {r.photos.length > 1 && (
              <div className="photos" style={{ marginTop: 8 }}>
                {r.photos.slice(1).map((u) => <FileTile key={u} url={u} onClick={() => openImg(u)} />)}
              </div>
            )}
          </>
        )}

        <div className={'big-status s-' + s.k}>
          <div className="ic">{ICON[s.k]}</div>
          <div className="grow">
            <b>{s.label}</b>
            {s.end && <div className="small">{s.k === 'expired' ? 'הסתיימה ב-' : 'בתוקף עד '}{fmtDate(s.end)}{r.ext_months ? ' (כולל הרחבה)' : ''}</div>}
            {(s.k === 'active' || s.k === 'soon') && <div className="bar"><div style={{ width: pct + '%' }} /></div>}
          </div>
        </div>

        <button className="btn block" style={{ height: 52, fontSize: 17, borderColor: 'var(--amber)', color: 'var(--amber)' }} onClick={() => setBroken(true)}>
          🔧 המוצר התקלקל — מה עושים?
        </button>

        <dl className="kv">
          {r.purchase_date && <><dt>📅 נקנה</dt><dd>{fmtDate(r.purchase_date)}</dd></>}
          {r.price !== null && r.price !== undefined && <><dt>💰 מחיר</dt><dd>{fmtPrice(r.price)}</dd></>}
          <dt>🛡️ אחריות</dt><dd>{monthsLabel(r.warranty_months)}{base && r.ext_months ? ` (עד ${fmtDate(base)})` : ''}</dd>
          {r.ext_months > 0 && <><dt>➕ הרחבה</dt><dd>{monthsLabel(r.ext_months)}{r.ext_provider ? ` · ${r.ext_provider}` : ''}{r.ext_price != null ? ` · ${fmtPrice(r.ext_price)}` : ''}</dd></>}
          {r.category && <><dt>{catEmoji(r.category)} קטגוריה</dt><dd>{r.category}</dd></>}
          {r.service_phone && <><dt>📞 שירות</dt><dd><a href={tel(r.service_phone)} dir="ltr">{r.service_phone}</a></dd></>}
          {r.store_phone && <><dt>🏪 חנות</dt><dd><a href={tel(r.store_phone)} dir="ltr">{r.store_phone}</a></dd></>}
          {r.serial && <><dt>🔢 סידורי</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{r.serial}</dd></>}
          {r.receipt_no && <><dt>🧾 קבלה מס׳</dt><dd dir="ltr" style={{ textAlign: 'right' }}>{r.receipt_no}</dd></>}
          {r.items?.length > 1 && <><dt>📦 בקבלה</dt><dd>{r.items.join(' · ')}</dd></>}
          {r.notes && <><dt>📝 הערות</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{r.notes}</dd></>}
        </dl>

        <div className="grid2">
          <button className="btn primary" onClick={onEdit}>✏️ עריכה</button>
          <button className="btn" onClick={share}>📤 שיתוף</button>
        </div>
        <button className="btn danger block" style={{ marginTop: 10 }} onClick={onDelete}>🗑️ מחיקה</button>
      </Sheet>

      {broken && <Broken r={r} s={s} base={base} onClose={() => setBroken(false)} onEdit={() => { setBroken(false); onEdit(); }} onShowReceipt={() => { setBroken(false); if (r.photos?.[0]) openImg(r.photos[0]); }} say={say} />}

      {view >= 0 && gallery[view] && (
        <div className="viewer" data-swipe-close="[data-close]">
          <div className="vimg"><img src={gallery[view]} alt="" /></div>
          <div className="vbar">
            <button data-close onClick={() => setView(-1)}>✕ סגור</button>
            {gallery.length > 1 && <span style={{ color: '#fff', alignSelf: 'center' }}>{view + 1} / {gallery.length}</span>}
            <div className="row">
              {gallery.length > 1 && <button onClick={() => setView((view + 1) % gallery.length)}>הבאה ‹</button>}
              <a href={gallery[view]} target="_blank" rel="noreferrer"><button>⬇️ פתח</button></a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// "המוצר התקלקל": האם יש אחריות, למי לפנות, והודעה מוכנה עם כל הפרטים
function Broken({ r, s, base, onClose, onEdit, onShowReceipt, say }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const inBase = base && base >= today;
  const inExt = !inBase && s.end && s.end >= today && r.ext_months > 0;
  const covered = inBase || inExt;
  const name = r.product || 'המוצר';
  const msg = [
    'שלום,',
    `${name} שקניתי${r.store ? ' ב' + r.store : ''}${r.purchase_date ? ' בתאריך ' + fmtDate(r.purchase_date) : ''} התקלקל.`,
    covered ? `המוצר באחריות עד ${fmtDate(inBase ? base : s.end)}${inExt && r.ext_provider ? ' (הרחבת אחריות ' + r.ext_provider + ')' : ''}.` : '',
    r.serial ? `מספר סידורי: ${r.serial}` : '',
    r.receipt_no ? `מספר קבלה: ${r.receipt_no}` : '',
    'התקלה: ',
    '',
    'אשמח לדעת איך מתקדמים לתיקון. מצרף/ת את הקבלה.',
    ...(r.photos || []).slice(0, 2),
  ].filter((x, i) => x !== '' || i === 6).join('\n');

  const wa = (phone) => `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(msg)}`;
  const anyPhone = r.service_phone || r.store_phone;

  return (
    <Sheet onClose={onClose}>
      <h3>🔧 {name} התקלקל</h3>
      <div className={'big-status s-' + (covered ? 'active' : s.k === 'none' || s.k === 'unknown' ? 'unknown' : 'expired')} style={{ marginTop: 0 }}>
        <div className="ic">{covered ? '✅' : '❌'}</div>
        <div className="grow">
          {covered ? (
            <><b>יש אחריות — התיקון אמור להיות בחינם</b>
              <div className="small">{inExt ? `האחריות הרגילה נגמרה, אבל יש הרחבה${r.ext_provider ? ' של ' + r.ext_provider : ''} עד ${fmtDate(s.end)}` : `באחריות עד ${fmtDate(base)}`}</div></>
          ) : s.k === 'expired' ? (
            <><b>האחריות נגמרה ב-{fmtDate(s.end)}</b><div className="small">התיקון כנראה בתשלום. עדיין שווה לשאול — לפעמים מתחשבים.</div></>
          ) : (
            <><b>לא רשום כמה זמן אחריות</b><div className="small">בדוק בקבלה או בתעודת האחריות ועדכן בעריכה</div></>
          )}
        </div>
      </div>

      <div className="sec">למי פונים?</div>
      <div className="muted small" style={{ margin: '0 4px 8px' }}>
        {inExt && r.ext_provider ? `בזמן ההרחבה פונים ל${r.ext_provider}.` : 'בדרך כלל ליבואן / למעבדה המורשית שכתובה בתעודת האחריות. אם לא ברור — לחנות.'}
      </div>
      <div className="menu-list">
        {r.service_phone && (
          <a href={tel(r.service_phone)}><button><span className="ic">📞</span><span className="grow"><b>להתקשר לשירות / מעבדה</b><div className="muted small" dir="ltr" style={{ textAlign: 'right' }}>{r.service_phone}</div></span></button></a>
        )}
        {r.store_phone && (
          <a href={tel(r.store_phone)}><button><span className="ic">🏪</span><span className="grow"><b>להתקשר לחנות{r.store ? ' ' + r.store : ''}</b><div className="muted small" dir="ltr" style={{ textAlign: 'right' }}>{r.store_phone}</div></span></button></a>
        )}
        <a href={anyPhone && waNumber(anyPhone) ? wa(anyPhone) : `https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">
          <button><span className="ic">💬</span><span className="grow"><b>שליחת הודעה מוכנה בוואטסאפ</b><div className="muted small">עם כל הפרטים והקבלה — רק לכתוב מה התקלה</div></span></button>
        </a>
        <button onClick={async () => { try { await navigator.clipboard.writeText(msg); say('📋 ההודעה הועתקה'); } catch {} }}>
          <span className="ic">📋</span><span className="grow"><b>העתקת ההודעה</b><div className="muted small">להדביק במייל או בטופס באתר</div></span>
        </button>
        <a href={`https://www.google.com/search?q=${encodeURIComponent('מעבדה מורשית ' + (r.product || '') + ' טלפון')}`} target="_blank" rel="noreferrer">
          <button><span className="ic">🔎</span><span className="grow"><b>חיפוש מעבדה מורשית בגוגל</b></span></button>
        </a>
        {r.photos?.length > 0 && <button onClick={onShowReceipt}><span className="ic">🧾</span><span className="grow"><b>להראות את הקבלה</b><div className="muted small">במסך מלא, להציג בחנות או במעבדה</div></span></button>}
        {!anyPhone && <button onClick={onEdit}><span className="ic">➕</span><span className="grow"><b>להוסיף טלפון של מעבדה / חנות</b><div className="muted small">כדי שבפעם הבאה זה יהיה בלחיצה</div></span></button>}
      </div>
      <div className="muted small" style={{ marginTop: 12, lineHeight: 1.6 }}>
        💡 טיפים: לבקש תעודת מעבדה עם מספר קריאה · לצלם את המוצר והתקלה · לשמור את ההתכתבות (אפשר להוסיף כאן תמונות בעריכה)
      </div>
    </Sheet>
  );
}
