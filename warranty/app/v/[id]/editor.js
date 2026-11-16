'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image';
import { PRESETS, CATEGORIES, todayStr, expiryDate, fmtDate, monthsLabel } from '@/lib/warranty';
import Sheet from '@/components/Sheet';

async function upload(vaultId, file) {
  const blob = await compressImage(file, 1800, 0.82);
  const path = `${vaultId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('wr-photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('wr-photos').getPublicUrl(path).data.publicUrl;
}

// הוספה ועריכה של קבלה. בקבלה חדשה עם תמונות — מעלים וקוראים אותן, וממלאים רק שדות שלא נגעו בהם.
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
    notes: initial?.notes || '',
    items: initial?.items || [],
    photos: initial?.photos || [],
  }));
  const touched = useRef(new Set());
  const [uploading, setUploading] = useState(0);
  const [reading, setReading] = useState(false);
  const [readMsg, setReadMsg] = useState('');
  const [custom, setCustom] = useState(() => initial?.warranty_months > 0 && !PRESETS.some((p) => p.m === initial.warranty_months));
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
      try { urls.push(await upload(vaultId, file)); } catch { setErr('תמונה אחת לא עלתה. בדוק אינטרנט ונסה שוב.'); }
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
        fill('product', j.product); fill('store', j.store); fill('purchase_date', j.date); fill('price', j.price);
        fill('serial', j.serial); fill('category', j.category); fill('warranty_months', j.warranty_months);
        if (j.items?.length) n.items = [...new Set([...x.items, ...j.items])];
        return n;
      });
      if (j.warranty_months && !PRESETS.some((p) => p.m === j.warranty_months) && !touched.current.has('warranty_months')) setCustom(true);
      setReadMsg(j.product || j.store ? '✨ מילאנו את מה שהצלחנו לקרוא — בדוק שהכול נכון' : 'לא הצלחנו לקרוא את הקבלה — אפשר למלא ידנית');
    } catch (e) {
      setReadMsg(String(e.message) === 'no-ai' ? 'הקריאה האוטומטית עוד לא מחוברת — מלא ידנית' : 'לא הצלחנו לקרוא את הקבלה — אפשר למלא ידנית');
    }
    setReading(false);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (files?.length) addFiles(files, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!f.product.trim() && !f.store.trim() && !f.photos.length) return setErr('רשום לפחות שם מוצר או חנות');
    setBusy(true); setErr('');
    const payload = { ...f, id: initial?.id, price: f.price === '' ? '' : String(f.price), warranty_months: f.warranty_months === null || f.warranty_months === '' ? '' : String(f.warranty_months) };
    const { data, error } = await supabase.rpc('wr_save_receipt', { p_vault: vaultId, p: payload });
    setBusy(false);
    if (error) return setErr('השמירה נכשלה. בדוק חיבור ונסה שוב.');
    onSaved(data, isNew);
  }

  function close() {
    if (isNew && (f.photos.length || touched.current.size) && !confirm('לצאת בלי לשמור?')) return;
    onClose();
  }

  const end = expiryDate(f);
  const wm = f.warranty_months;

  return (
    <Sheet onClose={close}>
      <div className="row" style={{ marginBottom: 8 }}>
        <h3 className="grow" style={{ margin: 0 }}>{isNew ? '🧾 קבלה חדשה' : '✏️ עריכה'}</h3>
        <button className="btn sm" onClick={close}>ביטול</button>
      </div>

      <div className="photos">
        {f.photos.map((u) => (
          <div className="ph" key={u}>
            <img src={u} alt="" />
            <button className="x" onClick={() => setF((x) => ({ ...x, photos: x.photos.filter((p) => p !== u) }))} aria-label="הסר תמונה">✕</button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => <div className="ph" key={'u' + i} style={{ display: 'grid', placeItems: 'center' }}><div className="spin" style={{ width: 28, height: 28 }} /></div>)}
        <button className="add" onClick={() => moreRef.current.click()}>📷<br />{f.photos.length ? 'עוד תמונה' : 'הוסף תמונה'}</button>
        <input ref={moreRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { const l = Array.from(e.target.files || []).slice(0, 6); e.target.value = ''; addFiles(l, isNew && !f.photos.length); }} />
      </div>

      {(reading || uploading > 0) && (
        <div className="row" style={{ background: 'var(--brand-soft)', padding: 12, borderRadius: 12, marginTop: 10 }}>
          <div className="spin" style={{ width: 22, height: 22, borderWidth: 3 }} />
          <b className="small">{uploading ? 'מעלה תמונה…' : 'קורא את הקבלה…'}</b>
          <span className="muted small">אפשר כבר לכתוב</span>
        </div>
      )}
      {!reading && readMsg && <div className="muted small" style={{ marginTop: 10, fontWeight: 600 }}>{readMsg}</div>}

      <div className="field">
        <label>מה קנית?</label>
        <input className="input" value={f.product} onChange={(e) => set('product', e.target.value)} placeholder="למשל: מכונת כביסה LG" maxLength={120} />
        {f.items.length > 1 && (
          <div className="chips wrap-chips">
            {f.items.slice(0, 15).map((it) => (
              <button key={it} className={'chip' + (f.product === it ? ' on' : '')} onClick={() => set('product', it)}>{it}</button>
            ))}
          </div>
        )}
      </div>

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
        <div className="field">
          <label>מחיר (₪)</label>
          <input className="input" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" />
        </div>
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
        <div className="muted small" style={{ marginTop: 8 }}>
          {end ? <>🛡️ {monthsLabel(wm)} — האחריות עד <b>{fmtDate(end)}</b></> : wm === 0 ? 'שמור לעיון בלבד (החזרה, הוכחת קנייה)' : !f.purchase_date && wm ? 'בחר תאריך קנייה כדי לחשב עד מתי' : ''}
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

      <div className="field">
        <label>מספר סידורי / IMEI (לא חובה)</label>
        <input className="input" dir="ltr" value={f.serial} onChange={(e) => set('serial', e.target.value)} maxLength={80} />
      </div>
      <div className="field">
        <label>הערות (לא חובה)</label>
        <textarea className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} maxLength={2000}
          placeholder="למשל: טלפון מעבדה 03-1234567, נקנה עם הרחבת אחריות…" />
      </div>

      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ height: 54, fontSize: 17, marginTop: 8 }} onClick={save} disabled={busy || uploading > 0}>
        {busy ? 'שומר…' : uploading ? 'מחכה לתמונות…' : '💾 שמור'}
      </button>
    </Sheet>
  );
}
