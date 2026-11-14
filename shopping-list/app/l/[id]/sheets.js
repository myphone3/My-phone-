'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, CAT_EMOJI } from '@/lib/catalog';
import { parseText, enTermFor, fmtQty, splitSpoken } from '@/lib/parse';
import { compressImage } from '@/lib/image';
import { getPref, setPref } from '@/lib/local';
import {
  DEFAULT_ORDER, catOrderOf, listAsText, autoSplit, assigneeOf, shekel, unitPrice, fmtDate,
} from '@/lib/order';

export const STATUS = {
  need: { label: 'צריך', icon: '', cls: '' },
  found: { label: 'נמצא', icon: '✓', cls: 'found' },
  partial: { label: 'חלקי', icon: '½', cls: 'partial' },
  missing: { label: 'אין במלאי', icon: '✕', cls: 'missing' },
  check: { label: 'לבדיקה', icon: '?', cls: 'ask' },
};
const COLORS = ['#16a34a', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#0891b2', '#dc2626'];
export const colorFor = (n = '') => {
  let h = 7;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

export function Sheet({ onClose, children }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

/* ---------- פריט ---------- */

function PriceHistory({ item, history }) {
  if (!history.length) return null;
  const last = history[0];
  const prevUnit = unitPrice(last.price, last.qty);
  const nowUnit = item.price ? unitPrice(item.price, item.found_qty || item.qty) : null;
  const avg = history.reduce((s, h) => s + unitPrice(h.price, h.qty), 0) / history.length;
  const min = Math.min(...history.map((h) => unitPrice(h.price, h.qty)));
  let verdict = null;
  if (nowUnit && prevUnit) {
    const pct = Math.round(((nowUnit - prevUnit) / prevUnit) * 100);
    if (Math.abs(pct) < 3) verdict = { t: 'בערך כמו בפעם הקודמת', c: 'var(--muted)' };
    else if (pct > 0) verdict = { t: `יקר ב-${pct}% מהפעם הקודמת (${shekel(nowUnit - prevUnit)} ליחידה)`, c: 'var(--red)' };
    else verdict = { t: `זול ב-${-pct}% מהפעם הקודמת 🎉`, c: 'var(--green)' };
  }
  const per = item.unit ? `ל${item.unit === 'ק"ג' ? 'ק"ג' : 'יחידה'}` : 'ליחידה';
  return (
    <div className="field">
      <label>📊 קניות קודמות</label>
      <div className="card" style={{ padding: '6px 12px' }}>
        {verdict && <div style={{ color: verdict.c, fontWeight: 700, padding: '6px 0' }}>{verdict.t}</div>}
        {history.map((h, k) => (
          <div key={k} className="preview-item small">
            <span className="grow">{fmtDate(h.at)}{h.store ? ` · ${h.store}` : ''}</span>
            <span>{fmtQty(h.qty || 1)}{h.unit ? ' ' + h.unit : ''} ב-<b>{shekel(h.price)}</b></span>
          </div>
        ))}
        {history.length > 1 && (
          <div className="muted small" style={{ padding: '6px 0' }}>ממוצע {shekel(avg)} {per} · הכי זול שהיה {shekel(min)} {per}</div>
        )}
      </div>
    </div>
  );
}

export function ItemSheet({ item, me, listId, list, participants, history, onClose, onUpdate, onDelete, say }) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note || '');
  const [price, setPrice] = useState(item.price ?? '');
  const [uploading, setUploading] = useState(false);
  const [imgs, setImgs] = useState(null);
  const fileRef = useRef(null);
  const deptWho = list?.assignments?.[item.category] || '';

  const setStatus = (s) => {
    if (s === item.status) return onUpdate({ status: 'need', done_by: null, found_qty: null });
    const patch = { status: s, done_by: me };
    let msg = '', push = false;
    if (s === 'found') { patch.found_qty = item.qty; patch.claimed_by = null; msg = `✓ ${me} מצא ${item.name}`; }
    if (s === 'missing') { patch.found_qty = 0; msg = `✕ ${me}: אין ${item.name}`; push = true; }
    if (s === 'partial') { patch.found_qty = item.found_qty ?? Math.max(0, item.qty - 1); msg = `½ ${me}: יש רק חלק מ${item.name}`; }
    if (s === 'check') { msg = `❓ ${me} צריך אישור על ${item.name}`; push = true; }
    onUpdate(patch, msg, push);
  };

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await compressImage(file, 1280, 0.8);
      const path = `${listId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from('sl-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('sl-photos').getPublicUrl(path);
      onUpdate({ photo_url: data.publicUrl, status: 'check', done_by: me }, `📷 ${me} שלח תמונה של ${item.name} — זה מה שצריך?`, true);
      say('התמונה נשלחה לכולם לאישור');
    } catch {
      say('העלאת התמונה נכשלה');
    }
    setUploading(false);
  }

  async function findImages() {
    setImgs('loading');
    try {
      const r = await fetch(`/api/image?q=${encodeURIComponent(item.name)}&en=${encodeURIComponent(enTermFor(item.name) || '')}`);
      const j = await r.json();
      setImgs(j.images || []);
    } catch { setImgs([]); }
  }

  const saveText = () => {
    const patch = {};
    if (name.trim() && name.trim() !== item.name) patch.name = name.trim();
    if ((note || null) !== (item.note || null)) patch.note = note;
    const p = price === '' ? null : Number(price);
    if (p !== (item.price == null ? null : Number(item.price))) patch.price = p;
    if (Object.keys(patch).length) onUpdate(patch);
  };

  return (
    <Sheet onClose={() => { saveText(); onClose(); }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div className="thumb" style={{ width: 64, height: 64 }}>
          {item.photo_url || item.image_url ? <img src={item.photo_url || item.image_url} alt="" referrerPolicy="no-referrer" /> : <span>{item.emoji || CAT_EMOJI[item.category]}</span>}
        </div>
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveText}
          style={{ fontWeight: 800, fontSize: 19 }} />
      </div>
      {item.added_by && <div className="muted small">נוסף ע״י {item.added_by}</div>}

      <div className="field">
        <label>מה המצב?</label>
        <div className="grid4">
          {['found', 'partial', 'missing', 'check'].map((s) => (
            <button key={s} className={`stat-btn ${s}` + (item.status === s ? ' on' : '')} onClick={() => setStatus(s)}>
              <span>{{ found: '✅', partial: '🌓', missing: '🚫', check: '❓' }[s]}</span>{STATUS[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="field" style={{ margin: 0 }}>
          <label>כמה צריך</label>
          <div className="stepper">
            <button onClick={() => onUpdate({ qty: Math.max(0.5, Number(item.qty) - 1) })}>−</button>
            <input inputMode="decimal" value={fmtQty(item.qty)} onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) onUpdate({ qty: v }); }} />
            <button onClick={() => onUpdate({ qty: Number(item.qty) + 1 })}>+</button>
          </div>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>יחידה</label>
          <select className="input" value={item.unit || ''} onChange={(e) => onUpdate({ unit: e.target.value })}>
            {['', 'ק"ג', 'גרם', 'ליטר', 'חבילות', 'בקבוקים', 'קופסאות', 'שקיות', 'מגשים', 'שישיות'].map((u) => (
              <option key={u} value={u}>{u || 'יחידות'}</option>
            ))}
          </select>
        </div>
      </div>

      {(item.status === 'partial' || item.status === 'found') && (
        <div className="field">
          <label>כמה נמצא בפועל</label>
          <div className="stepper">
            <button onClick={() => onUpdate({ found_qty: Math.max(0, Number(item.found_qty || 0) - 1), status: 'partial' })}>−</button>
            <input inputMode="decimal" value={fmtQty(item.found_qty ?? 0)} readOnly />
            <button onClick={() => {
              const v = Number(item.found_qty || 0) + 1;
              onUpdate({ found_qty: v, status: v >= item.qty ? 'found' : 'partial', done_by: me });
            }}>+</button>
          </div>
        </div>
      )}

      <div className="field">
        <label>👤 מי מביא את זה</label>
        <select className="input" value={item.assigned_to || ''} onChange={(e) => {
          const v = e.target.value;
          onUpdate({ assigned_to: v }, v ? `👤 ${item.name} → ${v}` : '');
        }}>
          <option value="">{deptWho ? `לפי המחלקה (${deptWho})` : 'לא נקבע'}</option>
          {participants.map((p) => <option key={p} value={p}>{p === me ? `${p} (אני)` : p}</option>)}
        </select>
      </div>

      <div className="field">
        {item.claimed_by && item.claimed_by !== me ? (
          <div className="row">
            <div className="grow">🔎 <b>{item.claimed_by}</b> מחפש את זה</div>
            <button className="btn sm" onClick={() => onUpdate({ claimed_by: me }, `🔎 ${me} לוקח את ${item.name}`)}>אני אקח</button>
          </div>
        ) : (
          <button className="btn block" onClick={() => onUpdate({ claimed_by: item.claimed_by ? null : me }, item.claimed_by ? '' : `🔎 ${me} מחפש ${item.name}`)}>
            {item.claimed_by ? '✋ הפסקתי לחפש' : '🔎 אני מחפש את זה עכשיו'}
          </button>
        )}
      </div>

      <div className="field">
        <label>תמונה מהחנות — לשאול אם זה המוצר הנכון</label>
        {item.photo_url && <img className="photo-big" src={item.photo_url} alt="" style={{ marginBottom: 8 }} />}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files?.[0])} />
        <div className="grid2">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'מעלה…' : '📷 צלם ושלח'}</button>
          {item.photo_url
            ? <button className="btn danger" onClick={() => onUpdate({ photo_url: null })}>הסר תמונה</button>
            : <button className="btn" onClick={findImages}>🖼️ תמונה לדוגמה</button>}
        </div>
        {imgs === 'loading' && <div className="muted small" style={{ marginTop: 8 }}>מחפש תמונות…</div>}
        {Array.isArray(imgs) && (
          <div style={{ marginTop: 8 }}>
            {imgs.length > 0 ? (
              <div className="imgs">
                {imgs.map((im, k) => (
                  <button key={k} onClick={() => { onUpdate({ image_url: im.thumb }); setImgs(null); }}>
                    <img src={im.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            ) : <div className="muted small">לא נמצאו תמונות.</div>}
            <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
              <a className="small" href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(item.name)}`} target="_blank" rel="noreferrer">חפש בגוגל תמונות ↗</a>
              {item.image_url && <button className="small" style={{ color: 'var(--red)' }} onClick={() => onUpdate({ image_url: null })}>הסר תמונה לדוגמה</button>}
            </div>
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="field" style={{ margin: 0 }}>
          <label>מחיר ששולם (₪, על הכל)</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} onBlur={saveText}
            placeholder={history[0] ? `פעם קודמת ${shekel(history[0].price)}` : '—'} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>מחלקה</label>
          <select className="input" value={item.category} onChange={(e) => onUpdate({ category: e.target.value, emoji: CAT_EMOJI[e.target.value] })}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.id}</option>)}
          </select>
        </div>
      </div>

      <PriceHistory item={{ ...item, price: price === '' ? null : Number(price) }} history={history} />

      <div className="field">
        <label>הערה (מותג, גודל, "רק אם במבצע"…)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveText} placeholder="למשל: תנובה 3%, הגדול" />
      </div>

      <div className="row">
        <button className="btn primary grow" onClick={() => { saveText(); onClose(); }}>סגור</button>
        <button className="btn danger" onClick={() => { if (confirm(`למחוק את ${item.name}?`)) onDelete(); }}>🗑️ מחק</button>
      </div>
    </Sheet>
  );
}

/* ---------- הוספת רשימה ---------- */

export function PasteSheet({ initial, ai, listId, onClose, onAdd }) {
  // בהקלטה: קודם פירוק מהיר לפי המילון, ואז (אם יש) הבינה המלאכותית משפרת
  const [text, setText] = useState(() => (ai && initial ? splitSpoken(initial).join('\n') : initial || ''));
  const [sugg, setSugg] = useState([]);
  const [aiCats, setAiCats] = useState({}); // שם → {category, emoji} מהבינה המלאכותית
  const [busy, setBusy] = useState('');
  const asked = useRef(new Set());
  const parsedRaw = useMemo(() => parseText(text), [text]);
  const parsed = useMemo(() => parsedRaw.map((p) => (p.category === 'אחר' && aiCats[p.name] ? { ...p, ...aiCats[p.name] } : p)), [parsedRaw, aiCats]);

  useEffect(() => {
    supabase.rpc('sl_suggestions', { p_list: listId }).then(({ data }) => setSugg(data || []));
  }, [listId]);

  // טקסט מהקלטה קולית — הבינה המלאכותית מפרקת לפריטים
  useEffect(() => {
    if (!ai || !initial) return;
    setBusy('מסדר את מה שאמרת…');
    fetch('/api/organize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: initial }) })
      .then((r) => r.json())
      .then((j) => { if (j.lines?.length) setText(j.lines.join('\n')); })
      .catch(() => {})
      .finally(() => setBusy(''));
  }, [ai, initial]);

  // מוצרים שהמילון לא הכיר → סיווג חכם (עם השהייה קצרה בזמן הקלדה)
  useEffect(() => {
    const unknown = parsedRaw.filter((p) => p.category === 'אחר' && !aiCats[p.name] && !asked.current.has(p.name)).map((p) => p.name);
    if (!unknown.length) return;
    const t = setTimeout(() => {
      unknown.forEach((n) => asked.current.add(n));
      fetch('/api/organize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: unknown }) })
        .then((r) => r.json())
        .then((j) => {
          if (!j.items?.length) return;
          setAiCats((prev) => {
            const next = { ...prev };
            j.items.forEach((it, k) => { const n = unknown.includes(it.name) ? it.name : unknown[k]; if (n) next[n] = { category: it.category, emoji: it.emoji || CAT_EMOJI[it.category] }; });
            return next;
          });
        })
        .catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [parsedRaw, aiCats]);

  async function fromClipboard() {
    try { const t = await navigator.clipboard.readText(); if (t) setText((p) => (p ? p + '\n' : '') + t); } catch {}
  }

  return (
    <Sheet onClose={onClose}>
      <h3>{ai ? '🎤 מה שאמרת' : '📋 הוספת רשימה'}</h3>
      <div className="muted small" style={{ marginBottom: 8 }}>
        הדבק כאן רשימה מהוואטסאפ, הערות או כל טקסט — כל שורה (או פסיק) הוא פריט. כמויות כמו "2 חלב" או "עגבניות 1 קילו" מזוהות לבד.
      </div>
      <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus={!initial}
        placeholder={'חלב 3\n2 ק"ג עגבניות\nלחם, ביצים, במבה\nנייר טואלט (הגדול)'} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={fromClipboard}>הדבק מהלוח</button>
        {busy && <span className="muted small">✨ {busy}</span>}
      </div>

      {sugg.length > 0 && (
        <div className="field">
          <label>⭐ קונים בדרך כלל — לחץ להוספה</label>
          <div className="sugg">
            {sugg.map((s) => (
              <button key={s.key} onClick={() => setText((p) => (p.trim() ? p.trimEnd() + '\n' : '') + s.name)}>
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {parsed.length > 0 && (
        <div className="field">
          <label>כך זה ייכנס ({parsed.length})</label>
          <div className="card" style={{ padding: '2px 12px' }}>
            {parsed.map((p, k) => (
              <div key={k} className="preview-item">
                <span style={{ fontSize: 22 }}>{p.emoji}</span>
                <span className="grow"><b>{p.name}</b>{p.note && <span className="muted small"> · {p.note}</span>}</span>
                {(p.qty !== 1 || p.unit) && <span className="qty">{fmtQty(p.qty)} {p.unit || ''}</span>}
                <span className="muted small">{aiCats[p.name] && p.category !== 'אחר' && parsedRaw[k]?.category === 'אחר' ? '✨ ' : ''}{p.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary grow" disabled={!parsed.length} onClick={() => onAdd(parsed)}>
          הוסף {parsed.length || ''} פריטים
        </button>
        <button className="btn" onClick={onClose}>ביטול</button>
      </div>
    </Sheet>
  );
}

/* ---------- חלוקה בין אנשים ---------- */

export function SplitSheet({ list, items, me, participants, onClose, onSave, notify }) {
  const order = catOrderOf(list);
  const [names, setNames] = useState(() => participants.length ? participants : [me].filter(Boolean));
  const [picked, setPicked] = useState(() => new Set(participants));
  const [extra, setExtra] = useState('');
  const [asg, setAsg] = useState(() => ({ ...(list?.assignments || {}) }));

  const left = items.filter((i) => i.status !== 'found');
  const cats = [...new Set(left.map((i) => i.category))].sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99));
  const countOf = (c) => left.filter((i) => i.category === c).length;
  const perPerson = {};
  for (const i of left) { const w = i.assigned_to || asg[i.category]; if (w) perPerson[w] = (perPerson[w] || 0) + 1; }

  const addName = () => {
    const n = extra.trim();
    if (!n) return;
    if (!names.includes(n)) setNames([...names, n]);
    setPicked(new Set([...picked, n]));
    setExtra('');
  };
  const toggle = (n) => { const s = new Set(picked); s.has(n) ? s.delete(n) : s.add(n); setPicked(s); };
  const auto = () => setAsg(autoSplit(items, list, names.filter((n) => picked.has(n))));

  function save() {
    onSave(asg, `👥 ${me} חילק את הרשימה — תבדקו מה שלכם ב"שלי"`);
    notify(`👥 ${me} חילק את הרשימה: ` + Object.entries(perPerson).map(([n, c]) => `${n} ${c}`).join(', '));
    onClose();
  }

  function sendPart(n) {
    const mine = items.filter((i) => i.status !== 'found' && (i.assigned_to || asg[i.category]) === n);
    const txt = listAsText(list, mine, { title: `החלק של ${n} — ${list?.name || ''}` }) + `\nלרשימה המלאה: ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank');
  }

  return (
    <Sheet onClose={onClose}>
      <h3>👥 חלוקה בין אנשים</h3>
      <div className="muted small">בוחרים מי מסתובב בחנות, ומחלקים — כל אחד מקבל אזור משלו. כל אחד יראה את החלק שלו בלחיצה על "שלי".</div>

      <div className="field">
        <label>מי בסופר?</label>
        <div className="sugg">
          {names.map((n) => (
            <button key={n} onClick={() => toggle(n)} style={picked.has(n) ? { background: colorFor(n), color: '#fff', borderColor: colorFor(n) } : {}}>
              {picked.has(n) ? '✓ ' : ''}{n}{n === me ? ' (אני)' : ''}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="להוסיף עוד מישהו (שם)" maxLength={30}
            onKeyDown={(e) => { if (e.key === 'Enter') addName(); }} />
          <button className="btn" onClick={addName}>הוסף</button>
        </div>
      </div>

      <button className="btn primary block" disabled={picked.size < 1 || !cats.length} onClick={auto}>
        ✨ חלק אוטומטית לפי אזורים בחנות
      </button>

      <div className="field">
        <label>או בחר ידנית לכל מחלקה</label>
        <div className="card" style={{ padding: '2px 12px' }}>
          {cats.length === 0 && <div className="muted small" style={{ padding: 10 }}>אין פריטים שנשארו לחלק</div>}
          {cats.map((c) => (
            <div key={c} className="preview-item">
              <span style={{ fontSize: 20 }}>{CAT_EMOJI[c]}</span>
              <span className="grow"><b>{c}</b> <span className="muted small">{countOf(c)}</span></span>
              <select className="input" style={{ width: 130, height: 38 }} value={asg[c] || ''}
                onChange={(e) => setAsg({ ...asg, [c]: e.target.value || undefined })}>
                <option value="">—</option>
                {names.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(perPerson).length > 0 && (
        <div className="field">
          <label>סיכום — אפשר גם לשלוח לכל אחד את החלק שלו בוואטסאפ</label>
          {Object.entries(perPerson).map(([n, c]) => (
            <div key={n} className="row" style={{ marginBottom: 6 }}>
              <div className="avatar" style={{ background: colorFor(n) }}>{n[0]}</div>
              <span className="grow"><b>{n}</b> · {c} פריטים</span>
              <button className="btn sm" onClick={() => sendPart(n)}>💬 שלח לו</button>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary grow" onClick={save}>שמור חלוקה</button>
        <button className="btn" onClick={() => setAsg({})}>נקה</button>
      </div>
      <div className="muted small" style={{ marginTop: 8 }}>טיפ: אפשר גם להעביר פריט בודד למישהו אחר מתוך מסך הפריט.</div>
    </Sheet>
  );
}

/* ---------- סניפים וסדר מחלקות ---------- */

export function StoreSheet({ list, onClose, onSave }) {
  const [stores, setStores] = useState(() => (list?.stores || []).map((s) => ({ ...s, order: s.order?.length ? s.order : [...DEFAULT_ORDER] })));
  const [cur, setCur] = useState(list?.store_id || '');
  const [editing, setEditing] = useState(null);
  const [newName, setNewName] = useState('');

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    const s = { id: Math.random().toString(36).slice(2, 10), name: n, order: [...DEFAULT_ORDER] };
    setStores([...stores, s]); setCur(s.id); setEditing(s.id); setNewName('');
  };
  const move = (sid, idx, dir) => setStores(stores.map((s) => {
    if (s.id !== sid) return s;
    const o = [...s.order]; const j = idx + dir;
    if (j < 0 || j >= o.length) return s;
    [o[idx], o[j]] = [o[j], o[idx]];
    return { ...s, order: o };
  }));
  const del = (sid) => { setStores(stores.filter((s) => s.id !== sid)); if (cur === sid) setCur(''); };
  const ed = stores.find((s) => s.id === editing);

  return (
    <Sheet onClose={onClose}>
      <h3>📍 סניף וסדר מחלקות</h3>
      <div className="muted small">לא חובה. אם תגדיר סניף, הרשימה תסודר לפי הסדר שבו אתם עוברים בו בפועל. גם המחירים נשמרים לפי סניף.</div>

      <div className="field">
        <label>באיזה סניף אתם עכשיו?</label>
        <div className="sugg">
          <button onClick={() => setCur('')} style={!cur ? { background: 'var(--ink)', color: 'var(--bg)' } : {}}>בלי סניף (סדר רגיל)</button>
          {stores.map((s) => (
            <button key={s.id} onClick={() => setCur(s.id)} style={cur === s.id ? { background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' } : {}}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input grow" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="סניף חדש, למשל: שופרסל דיל רמות" maxLength={40}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
          <button className="btn" onClick={add}>הוסף</button>
        </div>
      </div>

      {stores.length > 0 && (
        <div className="field">
          <label>סידור מחלקות לסניף</label>
          <div className="sugg" style={{ marginBottom: 8 }}>
            {stores.map((s) => (
              <button key={s.id} onClick={() => setEditing(editing === s.id ? null : s.id)} style={editing === s.id ? { borderColor: 'var(--green)', fontWeight: 700 } : {}}>
                ✏️ {s.name}
              </button>
            ))}
          </div>
          {ed && (
            <div className="card" style={{ padding: '2px 12px' }}>
              <div className="muted small" style={{ padding: '8px 0' }}>הזז למעלה את מה שנמצא ליד הכניסה ↑</div>
              {ed.order.map((c, k) => (
                <div key={c} className="preview-item">
                  <span className="muted small" style={{ width: 18 }}>{k + 1}</span>
                  <span style={{ fontSize: 20 }}>{CAT_EMOJI[c]}</span>
                  <span className="grow">{c}</span>
                  <button className="btn sm" onClick={() => move(ed.id, k, -1)} disabled={k === 0}>▲</button>
                  <button className="btn sm" onClick={() => move(ed.id, k, 1)} disabled={k === ed.order.length - 1}>▼</button>
                </div>
              ))}
              <button className="btn sm danger" style={{ margin: '10px 0' }} onClick={() => { if (confirm(`למחוק את הסניף ${ed.name}?`)) del(ed.id); }}>מחק סניף</button>
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary grow" onClick={() => { onSave({ stores, store_id: cur }); onClose(); }}>שמור</button>
        <button className="btn" onClick={onClose}>ביטול</button>
      </div>
    </Sheet>
  );
}

/* ---------- היסטוריית קניות ---------- */

export function TripsSheet({ listId, onClose }) {
  const [trips, setTrips] = useState(null);
  useEffect(() => { supabase.rpc('sl_trips_list', { p_list: listId }).then(({ data }) => setTrips(data || [])); }, [listId]);
  const withTotal = (trips || []).filter((t) => Number(t.total) > 0);
  const avg = withTotal.length ? withTotal.reduce((s, t) => s + Number(t.total), 0) / withTotal.length : 0;
  return (
    <Sheet onClose={onClose}>
      <h3>📊 קניות קודמות</h3>
      {trips === null && <div className="muted">טוען…</div>}
      {trips?.length === 0 && (
        <div className="muted">עוד אין היסטוריה. כשמסיימים קנייה לוחצים בתפריט על "🔄 קנייה חדשה" — והסיכום (כולל הסכום) נשמר כאן. כדאי לרשום מחירים בפריטים כדי להשוות.</div>
      )}
      {avg > 0 && <div className="alert" style={{ marginTop: 0, marginBottom: 10 }}>בממוצע קנייה עולה <b>{shekel(avg)}</b></div>}
      {trips?.map((t, k) => {
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
    </Sheet>
  );
}

/* ---------- תפריט ---------- */

function b64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function MenuSheet({ list, items, id, me, wake, store, onWake, onClose, onRename, onNewTrip, onChangeName, say, open }) {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/l/${id}` : '';
  const missing = items.filter((i) => i.status === 'missing' || i.status === 'partial');
  const [push, setPush] = useState(() => getPref('push_' + id, false));

  async function share() {
    const text = `בוא/י להצטרף לרשימת הקניות "${list?.name}" — כל מה שנמצא מתעדכן אצל כולם:\n${link}`;
    if (navigator.share) { try { await navigator.share({ title: list?.name, text }); return; } catch { return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
  async function copy(t, msg) {
    try { await navigator.clipboard.writeText(t); say(msg); } catch { say('לא הצלחתי להעתיק'); }
  }
  const wa = (t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');

  async function togglePush() {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (!reg || !('PushManager' in window)) {
        const ios = /iPhone|iPad/.test(navigator.userAgent);
        return say(ios ? 'באייפון: קודם "הוסף למסך הבית" מתפריט השיתוף, ואז להפעיל מהאפליקציה' : 'הדפדפן לא תומך בהתראות');
      }
      if (push) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) { await supabase.rpc('sl_push_delete', { p_endpoint: sub.endpoint }); }
        setPush(false); setPref('push_' + id, false); say('התראות כבויות לרשימה הזו');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return say('צריך לאשר התראות בהגדרות הדפדפן');
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
      const { error } = await supabase.rpc('sl_push_save', { p_list: id, p_sub: sub.toJSON(), p_name: me });
      if (error) throw error;
      setPush(true); setPref('push_' + id, true); say('🔔 תקבל התראה כשמוסיפים פריטים או שואלים אותך משהו');
    } catch {
      say('לא הצלחתי להפעיל התראות');
    }
  }

  return (
    <Sheet onClose={onClose}>
      <h3>{list?.name}</h3>
      <div className="menu-list">
        <button onClick={share}><span className="ic">➕</span>הזמן משתתפים לרשימה</button>
        <button onClick={() => open('split')}><span className="ic">👥</span>חלוקה בין אנשים — מי מביא מה</button>
        <button onClick={() => open('store')}><span className="ic">📍</span>סניף וסדר מחלקות{store ? `: ${store.name}` : ' (לא חובה)'}</button>
        <button onClick={() => open('trips')}><span className="ic">📊</span>קניות קודמות והשוואת מחירים</button>
        <button onClick={togglePush}><span className="ic">{push ? '🔔' : '🔕'}</span>התראות לטלפון: {push ? 'פועל' : 'כבוי'}</button>
        <button onClick={() => onWake(!wake)}><span className="ic">{wake ? '🔆' : '🔅'}</span>המסך לא נכבה בזמן קנייה: {wake ? 'פועל' : 'כבוי'}</button>
        <button onClick={() => wa(listAsText(list, items, { onlyLeft: true }))}><span className="ic">💬</span>שלח בוואטסאפ את מה שנשאר לקנות</button>
        {missing.length > 0 && (
          <button onClick={() => wa(`❌ *חסר ב${list?.name}:*\n` + missing.map((i) => `• ${i.name}${i.status === 'partial' ? ` (נמצאו ${fmtQty(i.found_qty || 0)}/${fmtQty(i.qty)})` : ''}`).join('\n'))}>
            <span className="ic">❌</span>שלח רשימת חסרים ({missing.length})
          </button>
        )}
        <button onClick={() => copy(link, 'הקישור הועתק')}><span className="ic">🔗</span>העתק קישור לרשימה</button>
        <button onClick={() => copy(listAsText(list, items), 'הרשימה הועתקה')}><span className="ic">📄</span>העתק את כל הרשימה כטקסט</button>
        <button onClick={() => { const n = prompt('שם הרשימה', list?.name || ''); if (n) onRename(n); }}><span className="ic">✏️</span>שנה שם רשימה</button>
        <button onClick={onChangeName}><span className="ic">🙂</span>השם שלי: {me || '—'}</button>
        <button onClick={() => { if (confirm('לסיים את הקנייה? הסיכום והמחירים יישמרו, מה שנמצא יימחק, ומה שחסר יישאר לפעם הבאה.')) onNewTrip(false); }}>
          <span className="ic">🔄</span>סיימנו — קנייה חדשה (משאיר את מה שחסר)
        </button>
        <button style={{ color: 'var(--red)' }} onClick={() => { if (confirm('למחוק את כל הפריטים ברשימה?')) onNewTrip(true); }}>
          <span className="ic">🗑️</span>רוקן את כל הרשימה
        </button>
      </div>
    </Sheet>
  );
}

export function NameSheet({ initial, onSave }) {
  const [n, setN] = useState(initial || '');
  return (
    <div className="sheet-bg">
      <div className="sheet">
        <div className="grab" />
        <h3>👋 איך קוראים לך?</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>כדי שכולם יראו מי מצא מה ומי מביא מה</div>
        <input className="input" value={n} onChange={(e) => setN(e.target.value)} autoFocus maxLength={30} placeholder="השם שלך"
          onKeyDown={(e) => { if (e.key === 'Enter' && n.trim()) onSave(n.trim()); }} />
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={!n.trim()} onClick={() => onSave(n.trim())}>המשך</button>
      </div>
    </div>
  );
}
