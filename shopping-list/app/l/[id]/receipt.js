'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image';
import { parseLine, fmtQty } from '@/lib/parse';
import { keyOf, shekel, unitPrice, fmtDate } from '@/lib/order';
import { Sheet } from './sheets';

// השוואת מחיר ליחידה מול מחיר קודם → {pct, cls}
function compare(total, qty, prev) {
  if (!prev || total == null) return null;
  const now = unitPrice(total, qty), before = unitPrice(prev.price, prev.qty);
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (Math.abs(pct) < 3) return { pct: 0, text: 'כמו בפעם הקודמת', color: 'var(--muted)' };
  return pct > 0
    ? { pct, text: `▲ ${pct}% (היה ${shekel(before)})`, color: 'var(--red)' }
    : { pct, text: `▼ ${-pct}% (היה ${shekel(before)})`, color: 'var(--green)' };
}

/* ---------- צילום וקריאת חשבונית ---------- */

export function ReceiptSheet({ listId, list, items, prices, me, onClose, onSaved, say }) {
  const [shots, setShots] = useState([]); // [{blob, url}]
  const [phase, setPhase] = useState('pick'); // pick | reading | review | saving
  const [data, setData] = useState(null);
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const photoUrls = useRef([]);

  async function addFiles(files) {
    const next = [...shots];
    for (const f of [...files].slice(0, 4 - shots.length)) {
      try {
        const blob = await compressImage(f, 2000, 0.85);
        next.push({ blob, url: URL.createObjectURL(blob) });
      } catch { say('לא הצלחתי לקרוא את התמונה'); }
    }
    setShots(next);
  }

  async function read() {
    setPhase('reading'); setErr('');
    try {
      const urls = [];
      for (const s of shots) {
        const path = `${listId}/receipt-${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from('sl-photos').upload(path, s.blob, { contentType: 'image/jpeg' });
        if (error) throw error;
        urls.push(supabase.storage.from('sl-photos').getPublicUrl(path).data.publicUrl);
      }
      photoUrls.current = urls;
      const r = await fetch('/api/receipt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list: listId, images: urls, items: items.map((i) => ({ id: i.id, name: i.name })) }),
      });
      const j = await r.json();
      if (!r.ok || !j.lines) throw new Error(j.error || 'read');
      if (!j.lines.length) throw new Error('empty');
      setData({ store: j.store || '', date: j.date || '', total: j.total });
      setLines(j.lines.map((l) => ({ ...l, action: l.match_id || 'extra' })));
      setPhase('review');
    } catch (e) {
      setErr(e.message === 'empty' ? 'לא מצאתי מוצרים בתמונה. נסה לצלם קרוב יותר, ישר ועם תאורה טובה.' : 'לא הצלחתי לקרוא את החשבונית. נסה שוב או צלם שוב.');
      setPhase('pick');
    }
  }

  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const sum = lines.filter((l) => l.action !== 'skip').reduce((s, l) => s + (Number(l.total) || 0), 0);
  const setLine = (k, patch) => setLines((ls) => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)));
  const prevFor = (l) => {
    const name = l.action && byId[l.action] ? byId[l.action].name : l.name;
    return prices[keyOf(name)]?.[0] || null;
  };

  async function save() {
    setPhase('saving');
    try {
      // 1) פריטים מהרשימה: מחיר + סימון שנקנה (כמה שורות לאותו פריט מתחברות)
      const perItem = {};
      for (const l of lines) {
        if (!byId[l.action]) continue;
        const p = (perItem[l.action] ||= { total: 0, qty: 0, weighed: false });
        p.total += Number(l.total) || 0;
        p.qty += Number(l.qty) || 1;
        if (l.unit) p.weighed = true;
      }
      for (const [id, p] of Object.entries(perItem)) {
        const it = byId[id];
        const patch = { price: Math.round(p.total * 100) / 100 };
        if (it.status !== 'found') { patch.status = 'found'; patch.done_by = it.done_by || me; }
        patch.found_qty = p.weighed ? it.found_qty ?? it.qty : p.qty;
        await supabase.rpc('sl_update_item', { p_list: listId, p_item: id, p: patch });
      }
      // 2) מוצרים שלא היו ברשימה ובחרו להוסיף — נכנסים כ"נקנה"
      const toAdd = lines.filter((l) => l.action === 'add').map((l) => {
        const parsed = parseLine(l.name) || { name: l.name, category: 'אחר' };
        return { name: parsed.name, category: parsed.category, emoji: parsed.emoji, qty: l.qty || 1, unit: l.unit || '', status: 'found', price: l.total, found_qty: l.qty || 1 };
      });
      if (toAdd.length) await supabase.rpc('sl_add_items', { p_list: listId, p_items: toAdd, p_by: me });
      // 3) החשבונית עצמה + מחירים של מוצרים שלא ברשימה (להשוואה בעתיד)
      const finalName = (l) => (byId[l.action] ? byId[l.action].name : l.name);
      const kept = lines.filter((l) => l.action !== 'skip');
      const { error } = await supabase.rpc('sl_save_receipt', {
        p_list: listId,
        p_by: me,
        p: {
          store: data.store, date: data.date, total: data.total ?? Math.round(sum * 100) / 100, photos: photoUrls.current,
          lines: kept.map((l) => ({ name: finalName(l), key: keyOf(finalName(l)), raw: l.raw, qty: l.qty, unit: l.unit, unit_price: l.unit_price, total: l.total, item_id: byId[l.action] ? l.action : null })),
          extra: lines.filter((l) => l.action === 'extra').map((l) => ({ name: l.name, qty: l.qty, unit: l.unit, total: l.total })),
        },
      });
      if (error) throw error;
      onSaved(data.total ?? sum);
    } catch {
      say('השמירה נכשלה, נסה שוב');
      setPhase('review');
    }
  }

  return (
    <Sheet onClose={phase === 'reading' || phase === 'saving' ? () => {} : onClose}>
      <h3>🧾 חשבונית</h3>

      {(phase === 'pick' || phase === 'reading') && (
        <>
          <div className="muted small" style={{ marginBottom: 10 }}>
            מצלמים את החשבונית בסוף הקנייה, והמחירים של כל מוצר נכנסים לבד. כך אפשר להשוות בין קניות ולראות מה התייקר. חשבונית ארוכה? אפשר לצלם עד 4 תמונות.
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { addFiles(e.target.files || []); e.target.value = ''; }} />
          {shots.length > 0 && (
            <div className="imgs" style={{ marginBottom: 10 }}>
              {shots.map((s, k) => (
                <button key={k} onClick={() => setShots(shots.filter((_, i) => i !== k))} title="הסר" disabled={phase === 'reading'}>
                  <img src={s.url} alt="" />
                </button>
              ))}
            </div>
          )}
          {err && <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 10 }}>{err}</div>}
          {phase === 'reading' ? (
            <div className="alert" style={{ marginTop: 0 }}>✨ קורא את החשבונית… זה לוקח בערך 10–30 שניות</div>
          ) : (
            <div className="grid2">
              <button className="btn" onClick={() => fileRef.current?.click()} disabled={shots.length >= 4}>
                📷 {shots.length ? 'עוד תמונה' : 'צלם חשבונית'}
              </button>
              <button className="btn primary" disabled={!shots.length} onClick={read}>✨ קרא חשבונית</button>
            </div>
          )}
        </>
      )}

      {(phase === 'review' || phase === 'saving') && data && (
        <>
          <div className="grid2">
            <div className="field" style={{ margin: 0 }}>
              <label>חנות</label>
              <input className="input" value={data.store} onChange={(e) => setData({ ...data, store: e.target.value })} placeholder="שם החנות" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>סה״כ בחשבונית</label>
              <input className="input" inputMode="decimal" value={data.total ?? ''} onChange={(e) => setData({ ...data, total: e.target.value === '' ? null : Number(e.target.value.replace(/[^\d.]/g, '')) })} />
            </div>
          </div>
          {data.total != null && Math.abs(sum - data.total) > 1 && (
            <div className="muted small" style={{ marginTop: 6 }}>סכום השורות {shekel(sum)} — הפרש של {shekel(Math.abs(sum - data.total))} מהסה״כ (הנחות כלליות / שורות שלא נקראו)</div>
          )}

          <div className="field">
            <label>{lines.length} מוצרים — בדוק שההתאמה לרשימה נכונה</label>
            <div className="card" style={{ padding: '2px 12px' }}>
              {lines.map((l, k) => {
                const cmp = l.action !== 'skip' ? compare(l.total, l.qty, prevFor(l)) : null;
                return (
                  <div key={k} className="preview-item" style={{ flexWrap: 'wrap', opacity: l.action === 'skip' ? 0.45 : 1 }}>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <b>{l.name}</b>
                      <span className="muted small"> {fmtQty(l.qty)}{l.unit ? ' ' + l.unit : ''}</span>
                      {cmp && <div className="small" style={{ color: cmp.color, fontWeight: 700 }}>{cmp.text}</div>}
                    </span>
                    <b>{shekel(l.total)}</b>
                    <select className="input" style={{ width: '100%', height: 36, fontSize: 14 }} value={l.action} onChange={(e) => setLine(k, { action: e.target.value })}>
                      <optgroup label="פריט ברשימה">
                        {items.map((i) => <option key={i.id} value={i.id}>✓ {i.name}</option>)}
                      </optgroup>
                      <option value="extra">לא ברשימה — רק לשמור מחיר</option>
                      <option value="add">➕ להוסיף לרשימה כנקנה</option>
                      <option value="skip">✕ לדלג על השורה</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="row">
            <button className="btn primary grow" onClick={save} disabled={phase === 'saving'}>{phase === 'saving' ? 'שומר…' : '💾 שמור מחירים'}</button>
            <button className="btn" onClick={onClose} disabled={phase === 'saving'}>ביטול</button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/* ---------- קניות קודמות + חשבוניות + השוואה ---------- */

function ReceiptDetails({ r, older }) {
  // לכל שורה: המחיר באותו מוצר בחשבונית קודמת
  const prevOf = (key) => {
    for (const o of older) {
      const l = (o.lines || []).find((x) => x.key === key);
      if (l) return { price: l.total, qty: l.qty, store: o.store, at: o.at };
    }
    return null;
  };
  return (
    <div style={{ marginTop: 8 }}>
      {(r.lines || []).map((l, k) => {
        const p = prevOf(l.key);
        const c = compare(l.total, l.qty, p);
        return (
          <div key={k} className="preview-item small">
            <span className="grow">{l.name} <span className="muted">{fmtQty(l.qty)}{l.unit ? ' ' + l.unit : ''}</span>
              {c && c.pct !== 0 && <div style={{ color: c.color, fontWeight: 700 }}>{c.text}{p.store && p.store !== r.store ? ` ב${p.store}` : ''}</div>}
            </span>
            <b>{shekel(l.total)}</b>
          </div>
        );
      })}
      {(r.photos || []).length > 0 && (
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          {r.photos.map((u, k) => <a key={k} href={u} target="_blank" rel="noreferrer" className="small">📷 תמונה {k + 1}</a>)}
        </div>
      )}
    </div>
  );
}

export function TripsSheet({ listId, onClose, onReceipt }) {
  const [trips, setTrips] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    supabase.rpc('sl_trips_list', { p_list: listId }).then(({ data }) => setTrips(data || []));
    supabase.rpc('sl_receipts_list', { p_list: listId }).then(({ data }) => setReceipts(data || []));
  }, [listId]);

  const withTotal = (trips || []).filter((t) => Number(t.total) > 0);
  const avg = withTotal.length ? withTotal.reduce((s, t) => s + Number(t.total), 0) / withTotal.length : 0;

  // מה התייקר/הוזל בחשבונית האחרונה לעומת קודמות
  const changes = useMemo(() => {
    if (receipts.length < 2) return [];
    const [last, ...older] = receipts;
    const out = [];
    for (const l of last.lines || []) {
      for (const o of older) {
        const p = (o.lines || []).find((x) => x.key === l.key);
        if (p) { const c = compare(l.total, l.qty, { price: p.total, qty: p.qty }); if (c && c.pct) out.push({ name: l.name, ...c }); break; }
      }
    }
    return out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 8);
  }, [receipts]);

  return (
    <Sheet onClose={onClose}>
      <h3>📊 קניות קודמות</h3>
      <button className="btn block" style={{ marginBottom: 12 }} onClick={onReceipt}>🧾 צלם חשבונית ושמור מחירים</button>

      {trips === null && <div className="muted">טוען…</div>}
      {avg > 0 && <div className="alert" style={{ marginTop: 0, marginBottom: 10 }}>בממוצע קנייה עולה <b>{shekel(avg)}</b></div>}

      {changes.length > 0 && (
        <div className="field">
          <label>מה השתנה בחשבונית האחרונה</label>
          <div className="card" style={{ padding: '2px 12px' }}>
            {changes.map((c, k) => (
              <div key={k} className="preview-item small"><span className="grow">{c.name}</span><b style={{ color: c.color }}>{c.text}</b></div>
            ))}
          </div>
        </div>
      )}

      {receipts.length > 0 && (
        <div className="field">
          <label>🧾 חשבוניות</label>
          {receipts.map((r, k) => {
            const prev = receipts.slice(k + 1).find((x) => Number(x.total) > 0);
            const d = prev && Number(r.total) > 0 ? Number(r.total) - Number(prev.total) : 0;
            return (
              <div key={r.id} className="card" style={{ padding: 12, marginBottom: 8 }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <div className="row">
                  <div className="grow">
                    <b>{r.bought_on ? new Date(r.bought_on).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' }) : fmtDate(r.at)}</b>
                    {r.store && <span className="muted small"> · {r.store}</span>}
                    <div className="muted small">{(r.lines || []).length} מוצרים{r.by_name ? ` · צילם ${r.by_name}` : ''} · לחץ לפירוט</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{r.total != null ? shekel(r.total) : '—'}</div>
                    {Math.abs(d) >= 1 && <div className="small" style={{ color: d > 0 ? 'var(--red)' : 'var(--green)' }}>{d > 0 ? '+' : '−'}{shekel(Math.abs(d))}</div>}
                  </div>
                </div>
                {open === r.id && <ReceiptDetails r={r} older={receipts.slice(k + 1)} />}
              </div>
            );
          })}
        </div>
      )}

      {trips?.length > 0 && (
        <div className="field">
          <label>🛒 סיכומי קניות</label>
          {trips.map((t, k) => {
            const prev = trips[k + 1];
            const d = prev && Number(prev.total) > 0 && Number(t.total) > 0 ? Number(t.total) - Number(prev.total) : 0;
            return (
              <div key={t.id} className="card" style={{ padding: 12, marginBottom: 8 }}>
                <div className="row">
                  <div className="grow">
                    <b>{new Date(t.at).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' })}</b>
                    {t.store && <span className="muted small"> · {t.store}</span>}
                    <div className="muted small">{t.found} פריטים נקנו{t.missing ? ` · ${t.missing} היו חסרים` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{Number(t.total) > 0 ? shekel(t.total) : '—'}</div>
                    {Math.abs(d) >= 1 && <div className="small" style={{ color: d > 0 ? 'var(--red)' : 'var(--green)' }}>{d > 0 ? '+' : '−'}{shekel(Math.abs(d))}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {trips?.length === 0 && receipts.length === 0 && (
        <div className="muted">עוד אין היסטוריה. בסוף קנייה מצלמים את החשבונית (או רושמים מחירים בפריטים), ולוחצים בתפריט "🔄 סיימנו — קנייה חדשה".</div>
      )}
    </Sheet>
  );
}
