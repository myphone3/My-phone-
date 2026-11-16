'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { prepareImage } from '@/lib/image';
import { getSetting } from '@/lib/settings';
import { rpc } from '@/lib/lock';
import { PRESETS, CATEGORIES, todayStr, expiryDate, baseExpiry, fmtDate, fmtPrice, monthsLabel, isPdf } from '@/lib/warranty';
import Sheet from '@/components/Sheet';

const EXT_PRESETS = [12, 24, 36];

async function upload(vaultId, file) {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  let body = file, type = 'application/pdf', ext = 'pdf';
  if (pdf) {
    if (file.size > 10 * 1024 * 1024) throw new Error('big');
  } else {
    body = await prepareImage(file, { improve: getSetting('enhance') });
    type = 'image/jpeg'; ext = 'jpg';
  }
  const path = `${vaultId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('wr-photos').upload(path, body, { contentType: type, cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('wr-photos').getPublicUrl(path).data.publicUrl;
}

export function FileTile({ url, onClick, children }) {
  return (
    <div className="ph" onClick={onClick}>
      {isPdf(url) ? <div className="pdf">📄<span>PDF</span></div> : <img src={url} alt="" />}
      {children}
    </div>
  );
}

// הוספה ועריכה של קבלה. בקבלה חדשה עם קבצים — מעלים וקוראים אותם, וממלאים רק שדות שלא נגעו בהם.
export default function Editor({ vaultId, initial, files, stores, onClose, onSaved, say }) {
  const isNew = !initial;
  const [f, setF] = useState(() => ({
    product: initial?.product || '',
    store: initial?.store || '',
    purchase_date: initial?.purchase_date || (isNew ? todayStr() : ''),
    price: initial?.price ?? '',
    warranty_months: initial ? initial.warranty_months : 12,
    category: initial?.category || '',
    serial: initial?.serial || '',
    receipt_no: initial?.receipt_no || '',
    store_phone: initial?.store_phone || '',
    service_phone: initial?.service_phone || '',
    ext_months: initial?.ext_months ?? '',
    ext_provider: initial?.ext_provider || '',
    ext_price: initial?.ext_price ?? '',
    notes: initial?.notes || '',
    items: initial?.items || [],
    photos: initial?.photos || [],
  }));
  const [prices, setPrices] = useState({}); // מחיר לכל מוצר שנקרא מהקבלה
  const [split, setSplit] = useState(false);
  const [picked, setPicked] = useState([]);
  const touched = useRef(new Set());
  const [uploading, setUploading] = useState(0);
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState('');
  const [custom, setCustom] = useState(() => initial?.warranty_months > 0 && !PRESETS.some((p) => p.m === initial.warranty_months));
  const [showExt, setShowExt] = useState(() => !!initial?.ext_months);
  const [more, setMore] = useState(() => !!(initial?.serial || initial?.receipt_no || initial?.store_phone || initial?.service_phone));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const moreRef = useRef(null);
  const started = useRef(false);

  const set = (k, v) => { touched.current.add(k); setF((x) => ({ ...x, [k]: v })); };

  async function addFiles(list, read) {
    if (!list.length) return;
    setUploading((n) => n + list.length);
    const urls = [];
    for (const file of list) {
      try { urls.push(await upload(vaultId, file)); } catch (e) { setErr(e.message === 'big' ? 'קובץ PDF גדול מדי (עד 10MB)' : 'קובץ אחד לא עלה. בדוק אינטרנט ונסה שוב.'); }
      setUploading((n) => n - 1);
    }
    if (!urls.length) return;
    setF((x) => ({ ...x, photos: [...x.photos, ...urls] }));
    if (read) readReceipt(urls);
  }

  async function readReceipt(urls) {
    setReading(true); setReadMsg('');
    try {
      const r = await fetch('/api/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ images: urls }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setF((x) => {
        const n = { ...x };
        const fill = (k, v) => { if (v !== null && v !== undefined && v !== '' && !touched.current.has(k)) n[k] = v; };
        ['product', 'store', 'price', 'serial', 'category', 'warranty_months', 'receipt_no', 'store_phone', 'service_phone', 'ext_months', 'ext_provider', 'ext_price'].forEach((k) => fill(k, j[k]));
        fill('purchase_date', j.date);
        if (j.items?.length) n.items = [...new Set([...x.items, ...j.items.map((i) => i.name)])];
        return n;
      });
      if (j.items?.length) setPrices((p) => ({ ...p, ...Object.fromEntries(j.items.map((i) => [i.name, i.price])) }));
      if (j.warranty_months && !PRESETS.some((p) => p.m === j.warranty_months) && !touched.current.has('warranty_months')) setCustom(true);
      if (j.ext_months) setShowExt(true);
      if (j.serial || j.receipt_no || j.store_phone || j.service_phone) setMore(true);
      setReadMsg(j.product || j.store ? '✨ מילאנו את מה שהצלחנו לקרוא — בדוק שהכול נכון' : 'לא הצלחנו לקרוא את הקבלה — אפשר למלא ידנית');
    } catch (e) {
      setReadMsg(String(e.message) === 'no-ai' ? 'הקריאה האוטומטית לא זמינה כרגע — מלא ידנית' : 'לא הצלחנו לקרוא את הקבלה — אפשר למלא ידנית');
    }
    setReading(false);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (files?.length) addFiles(files, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payload = (over = {}) => {
    const p = { ...f, ...over, id: over.id ?? initial?.id };
    for (const k of ['price', 'warranty_months', 'ext_months', 'ext_price']) p[k] = p[k] === null || p[k] === undefined || p[k] === '' ? '' : String(p[k]);
    if (!showExt) { p.ext_months = ''; p.ext_provider = ''; p.ext_price = ''; }
    return p;
  };

  async function save() {
    if (!f.product.trim() && !f.store.trim() && !f.photos.length) return setErr('רשום לפחות שם מוצר או חנות');
    setBusy(true); setErr('');
    if (isNew && split && picked.length > 1) {
      // כל מוצר נשמר כקבלה נפרדת (אותה תמונה, אותה חנות ותאריך)
      const out = [];
      for (const name of picked) {
        const { data, error } = await rpc('wr_save_receipt', vaultId, { p: payload({ product: name, price: prices[name] ?? '' }) });
        if (error) { setBusy(false); return setErr('חלק מהמוצרים לא נשמרו. נסה שוב.'); }
        out.push(data);
      }
      setBusy(false);
      return onSaved(out, true);
    }
    const { data, error } = await rpc('wr_save_receipt', vaultId, { p: payload() });
    setBusy(false);
    if (error) return setErr('השמירה נכשלה. בדוק חיבור ונסה שוב.');
    onSaved([data], isNew);
  }

  function close() {
    if (isNew && (f.photos.length || touched.current.size) && !confirm('לצאת בלי לשמור?')) return;
    onClose();
  }

  const end = expiryDate({ ...f, ext_months: showExt ? f.ext_months : 0 });
  const base = baseExpiry(f);
  const wm = f.warranty_months;
  const canSplit = isNew && f.items.length > 1;

  return (
    <Sheet onClose={close}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 className="grow" style={{ margin: 0 }}>{isNew ? '🧾 קבלה חדשה' : '✏️ עריכה'}</h3>
        <button className="btn sm" onClick={close}>ביטול</button>
      </div>

      <div className="photos">
        {f.photos.map((u) => (
          <FileTile url={u} key={u}>
            <button className="x" onClick={() => setF((x) => ({ ...x, photos: x.photos.filter((p) => p !== u) }))} aria-label="הסר">✕</button>
          </FileTile>
        ))}
        {Array.from({ length: uploading }).map((_, i) => <div className="ph" key={'u' + i} style={{ display: 'grid', placeItems: 'center' }}><div className="spin" style={{ width: 28, height: 28 }} /></div>)}
        <button className="add" onClick={() => moreRef.current.click()}>📷<br />{f.photos.length ? 'עוד קובץ' : 'תמונה / PDF'}</button>
        <input ref={moreRef} type="file" accept="image/*,application/pdf" multiple hidden
          onChange={(e) => { const l = Array.from(e.target.files || []).slice(0, 6); e.target.value = ''; addFiles(l, isNew && !f.photos.length); }} />
      </div>

      {(reading || uploading > 0) && (
        <div className="row" style={{ background: 'var(--brand-soft)', padding: 12, borderRadius: 12, marginTop: 10 }}>
          <div className="spin" style={{ width: 22, height: 22, borderWidth: 3 }} />
          <b className="small">{uploading ? 'מעלה…' : 'קורא את הקבלה…'}</b>
          <span className="muted small">אפשר כבר לכתוב</span>
        </div>
      )}
      {!reading && readMsg && <div className="muted small" style={{ marginTop: 10, fontWeight: 600 }}>{readMsg}</div>}

      {canSplit && (
        <div className="card" style={{ padding: 12, marginTop: 12, background: 'var(--bg)' }}>
          <label className="row" style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={split} onChange={(e) => { setSplit(e.target.checked); if (e.target.checked && !picked.length) setPicked(f.items.slice(0, 15)); }} style={{ width: 20, height: 20 }} />
            יש כמה מוצרים בקבלה — לשמור כל אחד בנפרד
          </label>
          {split && (
            <>
              <div className="muted small" style={{ margin: '6px 0' }}>כל מוצר יקבל כרטיס משלו עם אותה תמונה, ואפשר לערוך לכל אחד אחריות אחרת אחר כך.</div>
              {f.items.slice(0, 15).map((it) => (
                <label key={it} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <input type="checkbox" checked={picked.includes(it)} style={{ width: 20, height: 20 }}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, it] : p.filter((x) => x !== it)))} />
                  <span className="grow">{it}</span>
                  {prices[it] != null && <span className="muted">{fmtPrice(prices[it])}</span>}
                </label>
              ))}
            </>
          )}
        </div>
      )}

      {!(split && canSplit) && (
        <div className="field">
          <label>מה קנית?</label>
          <input className="input" value={f.product} onChange={(e) => set('product', e.target.value)} placeholder="למשל: מכונת כביסה LG" maxLength={120} />
          {f.items.length > 1 && (
            <div className="chips wrap-chips">
              {f.items.slice(0, 15).map((it) => (
                <button key={it} className={'chip' + (f.product === it ? ' on' : '')} onClick={() => { set('product', it); if (prices[it] != null) set('price', prices[it]); }}>{it}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label>חנות</label>
        <input className="input" value={f.store} onChange={(e) => set('store', e.target.value)} placeholder="למשל: KSP" maxLength={80} list="wr-stores" />
        <datalist id="wr-stores">{stores.map((s) => <option key={s} value={s} />)}</datalist>
      </div>

      <div className="grid2">
        <div className="field">
          <label>תאריך קנייה</label>
          <input className="input" type="date" value={f.purchase_date || ''} max={todayStr()} onChange={(e) => set('purchase_date', e.target.value)} />
        </div>
        {!(split && canSplit) && (
          <div className="field">
            <label>מחיר (₪)</label>
            <input className="input" inputMode="decimal" value={f.price ?? ''} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
          </div>
        )}
      </div>

      <div className="field">
        <label>כמה זמן אחריות?</label>
        <div className="chips wrap-chips" style={{ paddingTop: 0 }}>
          {PRESETS.map((p) => (
            <button key={p.m} className={'chip' + (!custom && wm === p.m ? ' on' : '')} onClick={() => { setCustom(false); set('warranty_months', p.m); }}>{p.label}</button>
          ))}
          <button className={'chip' + (custom ? ' on' : '')} onClick={() => { setCustom(true); if (PRESETS.some((p) => p.m === wm)) set('warranty_months', ''); }}>אחר…</button>
        </div>
        {custom && (
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" style={{ width: 110 }} inputMode="numeric" value={wm ?? ''} autoFocus
              onChange={(e) => set('warranty_months', e.target.value === '' ? '' : Math.min(240, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))} placeholder="18" />
            <span className="muted">חודשים</span>
          </div>
        )}

        {wm > 0 && (
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setShowExt(!showExt)}>
            {showExt ? '− בלי הרחבת אחריות' : '➕ קניתי הרחבת אחריות'}
          </button>
        )}
        {showExt && wm > 0 && (
          <div className="card" style={{ padding: 12, marginTop: 8, background: 'var(--bg)' }}>
            <div className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>🛡️➕ הרחבת אחריות (מתחילה כשהרגילה נגמרת)</div>
            <div className="chips wrap-chips" style={{ paddingTop: 0 }}>
              {EXT_PRESETS.map((m) => (
                <button key={m} className={'chip' + (Number(f.ext_months) === m ? ' on' : '')} onClick={() => set('ext_months', m)}>+{monthsLabel(m)}</button>
              ))}
              <input className="input" style={{ width: 90, height: 34 }} inputMode="numeric" placeholder="חודשים"
                value={EXT_PRESETS.includes(Number(f.ext_months)) ? '' : f.ext_months ?? ''}
                onChange={(e) => set('ext_months', e.target.value.replace(/\D/g, '').slice(0, 3))} />
            </div>
            <div className="grid2" style={{ marginTop: 8 }}>
              <input className="input" value={f.ext_provider} onChange={(e) => set('ext_provider', e.target.value)} placeholder="מי נותן? (למשל שקל)" maxLength={80} />
              <input className="input" inputMode="decimal" value={f.ext_price ?? ''} onChange={(e) => set('ext_price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="כמה עלה ₪" />
            </div>
          </div>
        )}

        <div className="muted small" style={{ marginTop: 8 }}>
          {end ? <>🛡️ {monthsLabel(wm)}{showExt && Number(f.ext_months) > 0 ? ` + הרחבה של ${monthsLabel(Number(f.ext_months))}` : ''} — האחריות עד <b>{fmtDate(end)}</b>{showExt && Number(f.ext_months) > 0 && base ? ` (הרגילה עד ${fmtDate(base)})` : ''}</>
            : wm === 0 ? 'שמור לעיון בלבד (החזרה, הוכחת קנייה)' : !f.purchase_date && wm ? 'בחר תאריך קנייה כדי לחשב עד מתי' : ''}
        </div>
      </div>

      <div className="field">
        <label>קטגוריה</label>
        <div className="chips wrap-chips" style={{ paddingTop: 0 }}>
          {CATEGORIES.map((c) => (
            <button key={c.k} className={'chip' + (f.category === c.k ? ' on' : '')} onClick={() => set('category', f.category === c.k ? '' : c.k)}>{c.e} {c.k}</button>
          ))}
        </div>
      </div>

      {!more ? (
        <button className="btn block" onClick={() => setMore(true)}>➕ טלפון למעבדה, מספר סידורי, מספר קבלה…</button>
      ) : (
        <>
          <div className="grid2">
            <div className="field"><label>📞 טלפון שירות / מעבדה</label>
              <input className="input" dir="ltr" inputMode="tel" value={f.service_phone} onChange={(e) => set('service_phone', e.target.value)} maxLength={30} /></div>
            <div className="field"><label>🏪 טלפון החנות</label>
              <input className="input" dir="ltr" inputMode="tel" value={f.store_phone} onChange={(e) => set('store_phone', e.target.value)} maxLength={30} /></div>
          </div>
          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="field"><label>🔢 מספר סידורי / IMEI</label>
              <input className="input" dir="ltr" value={f.serial} onChange={(e) => set('serial', e.target.value)} maxLength={80} /></div>
            <div className="field"><label>🧾 מספר קבלה</label>
              <input className="input" dir="ltr" value={f.receipt_no} onChange={(e) => set('receipt_no', e.target.value)} maxLength={40} /></div>
          </div>
        </>
      )}
      <div className="field">
        <label>הערות (לא חובה)</label>
        <textarea className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000} placeholder="כל דבר שכדאי לזכור" />
      </div>

      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ height: 54, fontSize: 17, marginTop: 8 }} onClick={save} disabled={busy || uploading > 0 || (split && canSplit && !picked.length)}>
        {busy ? 'שומר…' : uploading ? 'מחכה לקבצים…' : split && canSplit ? `💾 שמור ${picked.length} מוצרים` : '💾 שמור'}
      </button>
    </Sheet>
  );
}
