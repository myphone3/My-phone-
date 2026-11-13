'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, CAT_ORDER, CAT_EMOJI } from '@/lib/catalog';
import { parseText, enTermFor, fmtQty } from '@/lib/parse';
import { getMyName, setMyName, rememberList, getPref, setPref } from '@/lib/local';
import { compressImage } from '@/lib/image';

const STATUS = {
  need: { label: 'צריך', icon: '', cls: '' },
  found: { label: 'נמצא', icon: '✓', cls: 'found' },
  partial: { label: 'חלקי', icon: '½', cls: 'partial' },
  missing: { label: 'אין במלאי', icon: '✕', cls: 'missing' },
  check: { label: 'לבדיקה', icon: '?', cls: 'check' },
};
const STATUS_RANK = { need: 0, check: 1, partial: 2, missing: 3, found: 4 };
const COLORS = ['#16a34a', '#2563eb', '#db2777', '#d97706', '#7c3aed', '#0891b2', '#dc2626'];
const colorFor = (n = '') => COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const FILTERS = [
  ['all', 'הכל'], ['left', 'נשאר'], ['mine', 'אני מחפש'], ['check', 'לבדיקה'], ['missing', 'חסר'], ['found', 'נמצא'],
];

export default function ListPage() {
  const { id } = useParams();
  const router = useRouter();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState('');
  const [askName, setAskName] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [paste, setPaste] = useState(null); // טקסט להדבקה, או null
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState('');
  const [toast, setToast] = useState('');
  const [people, setPeople] = useState([]);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [wake, setWake] = useState(false);
  const chan = useRef(null);
  const toastT = useRef(null);
  const meRef = useRef('');

  const say = useCallback((t) => {
    setToast(t);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const applyRows = useCallback((rows) => {
    setItems((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      for (const r of rows) {
        if (!r || !r.id) continue;
        const old = map.get(r.id);
        if (!old || new Date(r.updated_at) >= new Date(old.updated_at)) map.set(r.id, r);
      }
      return [...map.values()];
    });
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('sl_get_list', { p_list: id });
    setLoading(false);
    if (error || !data?.list) { setNotFound(true); return; }
    setList(data.list);
    setItems(data.items || []);
    rememberList(id, data.list.name);
  }, [id]);

  // טעינה + זמן אמת
  useEffect(() => {
    const n = getMyName();
    setMe(n); meRef.current = n;
    if (!n) setAskName(true);
    setWake(getPref('wake', false));
    load();

    const ch = supabase.channel(`sl:${id}`, { config: { broadcast: { self: false }, presence: { key: n || 'אורח' } } });
    ch.on('broadcast', { event: 'change' }, ({ payload }) => {
      if (payload.rows) applyRows(payload.rows);
      if (payload.deleted) setItems((p) => p.filter((i) => !payload.deleted.includes(i.id)));
      if (payload.reload) load();
      if (payload.list) setList((l) => ({ ...l, ...payload.list }));
      if (payload.msg && payload.by !== meRef.current) {
        say(payload.msg);
        if (navigator.vibrate) navigator.vibrate(60);
      }
    });
    ch.on('presence', { event: 'sync' }, () => {
      setPeople(Object.keys(ch.presenceState()).filter((k) => k && k !== 'אורח'));
    });
    ch.subscribe((s) => { if (s === 'SUBSCRIBED') ch.track({ at: Date.now() }); });
    chan.current = ch;

    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    const poll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 45000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [id, load, applyRows, say]);

  // המסך לא נכבה בזמן קנייה
  useEffect(() => {
    if (!wake || !('wakeLock' in navigator)) return;
    let lock = null;
    const get = async () => { try { lock = await navigator.wakeLock.request('screen'); } catch {} };
    get();
    const onVis = () => { if (document.visibilityState === 'visible') get(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); lock?.release?.(); };
  }, [wake]);

  const broadcast = (payload) => chan.current?.send({ type: 'broadcast', event: 'change', payload: { ...payload, by: meRef.current } });

  async function addParsed(parsed) {
    if (!parsed.length) return;
    const payload = parsed.map(({ en, ...rest }) => rest);
    const { data, error } = await supabase.rpc('sl_add_items', { p_list: id, p_items: payload, p_by: me });
    if (error) return say('שגיאה בהוספה, נסה שוב');
    applyRows(data);
    broadcast({ rows: data, msg: `${me || 'מישהו'} הוסיף ${parsed.length === 1 ? parsed[0].name : parsed.length + ' פריטים'}` });
    say(parsed.length === 1 ? `נוסף: ${parsed[0].name}` : `נוספו ${parsed.length} פריטים`);
  }

  async function update(item, patch, msg) {
    const optimistic = { ...item, ...patch, updated_at: new Date().toISOString() };
    applyRows([optimistic]);
    const { data, error } = await supabase.rpc('sl_update_item', { p_list: id, p_item: item.id, p: patch });
    if (error || !data) { say('לא נשמר — בדוק אינטרנט'); load(); return; }
    applyRows([data]);
    broadcast({ rows: [data], msg });
  }

  async function remove(item) {
    setItems((p) => p.filter((i) => i.id !== item.id));
    setOpenId(null);
    await supabase.rpc('sl_delete_item', { p_list: id, p_item: item.id });
    broadcast({ deleted: [item.id] });
  }

  function toggleFound(item) {
    if (navigator.vibrate) navigator.vibrate(25);
    if (item.status === 'found') {
      update(item, { status: 'need', done_by: null, found_qty: null });
    } else {
      update(item, { status: 'found', done_by: me, found_qty: item.qty, claimed_by: null }, `✓ ${me} מצא ${item.name}`);
    }
  }

  function quickAdd() {
    const t = quick.trim();
    if (!t) return;
    const parsed = parseText(t);
    if (parsed.length > 1) { setPaste(t); setQuick(''); return; }
    addParsed(parsed);
    setQuick('');
  }

  // מיון לפי מחלקות בסופר
  const counts = useMemo(() => {
    const c = { total: items.length, found: 0, missing: 0, check: 0, partial: 0, mine: 0, price: 0 };
    for (const i of items) {
      if (i.status === 'found') c.found++;
      if (i.status === 'missing') c.missing++;
      if (i.status === 'check') c.check++;
      if (i.status === 'partial') c.partial++;
      if (i.claimed_by && i.claimed_by === me && i.status !== 'found') c.mine++;
      if (i.price) c.price += Number(i.price);
    }
    return c;
  }, [items, me]);

  const groups = useMemo(() => {
    const f = items.filter((i) => {
      if (filter === 'left') return i.status === 'need' || i.status === 'partial' || i.status === 'check';
      if (filter === 'found') return i.status === 'found';
      if (filter === 'missing') return i.status === 'missing' || i.status === 'partial';
      if (filter === 'check') return i.status === 'check';
      if (filter === 'mine') return i.claimed_by === me && i.status !== 'found';
      return true;
    });
    f.sort((a, b) =>
      (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99) ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.created_at.localeCompare(b.created_at));
    const g = [];
    for (const i of f) {
      if (!g.length || g[g.length - 1].cat !== i.category) g.push({ cat: i.category, items: [] });
      g[g.length - 1].items.push(i);
    }
    return g;
  }, [items, filter, me]);

  const pending = items.filter((i) => i.status === 'check' && i.photo_url);
  const open = items.find((i) => i.id === openId);
  const pct = counts.total ? Math.round((counts.found / counts.total) * 100) : 0;

  if (notFound) {
    return (
      <div className="wrap empty">
        <div className="big">🤷</div>
        <p>הרשימה לא נמצאה. אולי הקישור לא שלם?</p>
        <button className="btn" onClick={() => router.push('/')}>למסך הבית</button>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="top">
        <div className="row">
          <button className="icon-btn" onClick={() => router.push('/')} aria-label="חזרה">›</button>
          <div className="grow">
            <h1 className="title">{list?.name || 'טוען…'}</h1>
            <div className="muted small">
              {counts.found}/{counts.total} נמצאו
              {counts.missing > 0 && ` · ${counts.missing} חסרים`}
              {counts.price > 0 && ` · ₪${counts.price.toFixed(counts.price % 1 ? 2 : 0)}`}
            </div>
          </div>
          <div className="people" title={people.join(', ')}>
            {people.slice(0, 4).map((p) => (
              <div key={p} className="avatar" style={{ background: colorFor(p) }}>{p[0]}</div>
            ))}
          </div>
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="תפריט">⋯</button>
        </div>
        <div className="progress" style={{ marginTop: 10 }}><div style={{ width: pct + '%' }} /></div>
        <div className="chips">
          {FILTERS.map(([k, label]) => {
            const n = { left: counts.total - counts.found - counts.missing, found: counts.found, missing: counts.missing + counts.partial, check: counts.check, mine: counts.mine }[k];
            if (k === 'mine' && !counts.mine && filter !== 'mine') return null;
            if (k === 'check' && !counts.check && filter !== 'check') return null;
            return (
              <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
                {label}{n != null && n > 0 ? ` ${n}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {pending.map((i) => (
        <div key={i.id} className="alert">
          <img src={i.photo_url} alt="" onClick={() => setViewPhoto(i.photo_url)} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{i.done_by || 'מישהו'} שואל: זה ה{i.name} הנכון?</div>
            {i.note && <div className="small muted">{i.note}</div>}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm primary" onClick={() => update(i, { status: 'found' }, `👍 ${me}: כן, זה ה${i.name} הנכון`)}>כן, קח</button>
              <button className="btn sm" onClick={() => update(i, { status: 'need', photo_url: null }, `👎 ${me}: לא, זה לא ה${i.name} הנכון`)}>לא</button>
            </div>
          </div>
        </div>
      ))}

      {loading && <div className="empty"><div className="big">⏳</div></div>}
      {!loading && items.length === 0 && (
        <div className="empty">
          <div className="big">📝</div>
          <p style={{ fontWeight: 700, color: 'var(--ink)' }}>הרשימה ריקה</p>
          <p>כתוב פריט למטה, או הדבק רשימה שלמה מהוואטסאפ — נסדר אותה לפי מחלקות.</p>
          <button className="btn primary" onClick={() => setPaste('')}>📋 הדבק רשימה</button>
        </div>
      )}
      {!loading && items.length > 0 && groups.length === 0 && <div className="empty">אין פריטים בסינון הזה</div>}

      {groups.map((g) => (
        <div key={g.cat}>
          <div className="cat">{CAT_EMOJI[g.cat] || '🛒'} {g.cat} <span className="count">{g.items.length}</span></div>
          {g.items.map((i) => (
            <ItemRow key={i.id} item={i} me={me} onOpen={() => setOpenId(i.id)} onToggle={() => toggleFound(i)}
              onPhoto={(u) => setViewPhoto(u)} />
          ))}
        </div>
      ))}

      <div className="addbar">
        <div className="in">
          <button className="icon-btn" onClick={() => setPaste('')} aria-label="הדבק רשימה">📋</button>
          <input className="input grow" value={quick} placeholder="הוסף פריט… (למשל: 2 חלב)"
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (t.includes('\n')) { e.preventDefault(); setPaste(t); }
            }} />
          <button className="icon-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }} onClick={quickAdd} aria-label="הוסף">+</button>
        </div>
      </div>

      {open && (
        <ItemSheet item={open} me={me} listId={id} onClose={() => setOpenId(null)}
          onUpdate={(patch, msg) => update(open, patch, msg)} onDelete={() => remove(open)} say={say} />
      )}
      {paste !== null && (
        <PasteSheet initial={paste} listId={id} onClose={() => setPaste(null)}
          onAdd={(parsed) => { addParsed(parsed); setPaste(null); }} />
      )}
      {menu && (
        <MenuSheet list={list} items={items} id={id} me={me} wake={wake}
          onWake={(v) => { setWake(v); setPref('wake', v); }}
          onClose={() => setMenu(false)} say={say}
          onRename={async (n) => {
            await supabase.rpc('sl_rename_list', { p_list: id, p_name: n });
            setList((l) => ({ ...l, name: n })); rememberList(id, n);
            broadcast({ list: { name: n } });
          }}
          onNewTrip={async (all) => {
            await supabase.rpc('sl_new_trip', { p_list: id, p_clear_all: all });
            await load();
            broadcast({ reload: true, msg: `${me} התחיל קנייה חדשה` });
            setMenu(false);
          }}
          onChangeName={() => { setMenu(false); setAskName(true); }} />
      )}
      {askName && (
        <NameSheet initial={me} onSave={(n) => {
          setMyName(n); setAskName(false);
          window.location.reload(); // מתחבר מחדש עם השם החדש
        }} />
      )}
      {viewPhoto && (
        <div className="sheet-bg" style={{ alignItems: 'center', background: 'rgba(0,0,0,.85)' }} onClick={() => setViewPhoto(null)}>
          <img src={viewPhoto} alt="" style={{ maxWidth: '96vw', maxHeight: '90vh', borderRadius: 12 }} />
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Thumb({ item, onPhoto }) {
  const src = item.photo_url || item.image_url;
  return (
    <div className="thumb" onClick={(e) => { if (src) { e.stopPropagation(); onPhoto(src); } }}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span>{item.emoji || CAT_EMOJI[item.category] || '🛒'}</span>}
    </div>
  );
}

function ItemRow({ item, me, onOpen, onToggle, onPhoto }) {
  const st = STATUS[item.status];
  return (
    <div className={'card item' + (item.status === 'found' ? ' found' : '')} onClick={onOpen}>
      <Thumb item={item} onPhoto={onPhoto} />
      <div className="grow">
        <div>
          <span className="iname">{item.name}</span>
          {(item.qty !== 1 || item.unit) && <span className="qty">{fmtQty(item.qty)}{item.unit ? ' ' + item.unit : ''}</span>}
        </div>
        <div className="meta">
          {item.status === 'found' && item.done_by && <span className="badge b-found">✓ {item.done_by}</span>}
          {item.status === 'partial' && <span className="badge b-partial">נמצאו {fmtQty(item.found_qty || 0)} מתוך {fmtQty(item.qty)}</span>}
          {item.status === 'missing' && <span className="badge b-missing">אין במלאי</span>}
          {item.status === 'check' && <span className="badge b-check">? לבדיקה</span>}
          {item.claimed_by && item.status !== 'found' && (
            <span className="badge b-claim">🔎 {item.claimed_by === me ? 'אני מחפש' : item.claimed_by + ' מחפש'}</span>
          )}
          {item.price ? <span>₪{Number(item.price)}</span> : null}
          {item.note && <span>{item.note}</span>}
        </div>
      </div>
      <button className={'check ' + st.cls} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="סמן כנמצא">
        {st.icon}
      </button>
    </div>
  );
}

function Sheet({ onClose, children }) {
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

function ItemSheet({ item, me, listId, onClose, onUpdate, onDelete, say }) {
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note || '');
  const [price, setPrice] = useState(item.price ?? '');
  const [uploading, setUploading] = useState(false);
  const [imgs, setImgs] = useState(null);
  const fileRef = useRef(null);

  const setStatus = (s) => {
    if (s === item.status) return onUpdate({ status: 'need', done_by: null, found_qty: null });
    const patch = { status: s, done_by: me };
    let msg = '';
    if (s === 'found') { patch.found_qty = item.qty; patch.claimed_by = null; msg = `✓ ${me} מצא ${item.name}`; }
    if (s === 'missing') { patch.found_qty = 0; msg = `✕ ${me}: אין ${item.name}`; }
    if (s === 'partial') { patch.found_qty = item.found_qty ?? Math.max(0, item.qty - 1); msg = `½ ${me}: יש רק חלק מ${item.name}`; }
    if (s === 'check') msg = `❓ ${me} צריך אישור על ${item.name}`;
    onUpdate(patch, msg);
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
      onUpdate({ photo_url: data.publicUrl, status: 'check', done_by: me }, `📷 ${me} שלח תמונה של ${item.name} — זה מה שצריך?`);
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
          {item.photo_url || item.image_url ? <img src={item.photo_url || item.image_url} alt="" /> : <span>{item.emoji || CAT_EMOJI[item.category]}</span>}
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
        {item.claimed_by && item.claimed_by !== me ? (
          <div className="row">
            <div className="grow">🔎 <b>{item.claimed_by}</b> מחפש את זה</div>
            <button className="btn sm" onClick={() => onUpdate({ claimed_by: me }, `🔎 ${me} לוקח את ${item.name}`)}>אני אקח</button>
          </div>
        ) : (
          <button className="btn block" onClick={() => onUpdate({ claimed_by: item.claimed_by ? null : me }, item.claimed_by ? '' : `🔎 ${me} מחפש ${item.name}`)}>
            {item.claimed_by ? '✋ הפסקתי לחפש' : '🔎 אני מחפש את זה (שאחרים לא יחפשו)'}
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
          <label>מחיר ששולם (₪)</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} onBlur={saveText} placeholder="—" />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>מחלקה</label>
          <select className="input" value={item.category} onChange={(e) => onUpdate({ category: e.target.value, emoji: CAT_EMOJI[e.target.value] })}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.id}</option>)}
          </select>
        </div>
      </div>

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

function PasteSheet({ initial, listId, onClose, onAdd }) {
  const [text, setText] = useState(initial || '');
  const [sugg, setSugg] = useState([]);
  const parsed = useMemo(() => parseText(text), [text]);

  useEffect(() => {
    supabase.rpc('sl_suggestions', { p_list: listId }).then(({ data }) => setSugg(data || []));
  }, [listId]);

  async function fromClipboard() {
    try { const t = await navigator.clipboard.readText(); if (t) setText((p) => (p ? p + '\n' : '') + t); } catch {}
  }

  return (
    <Sheet onClose={onClose}>
      <h3>📋 הוספת רשימה</h3>
      <div className="muted small" style={{ marginBottom: 8 }}>
        הדבק כאן רשימה מהוואטסאפ, הערות או כל טקסט — כל שורה (או פסיק) הוא פריט. כמויות כמו "2 חלב" או "עגבניות 1 קילו" מזוהות לבד.
      </div>
      <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} autoFocus={!initial}
        placeholder={'חלב 3\n2 ק"ג עגבניות\nלחם, ביצים, במבה\nנייר טואלט (הגדול)'} />
      <button className="btn sm" style={{ marginTop: 8 }} onClick={fromClipboard}>הדבק מהלוח</button>

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
                <span className="muted small">{p.category}</span>
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

function listAsText(list, items, onlyLeft) {
  const rows = items
    .filter((i) => (onlyLeft ? i.status !== 'found' : true))
    .sort((a, b) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99));
  let out = `🛒 *${list?.name || 'רשימת קניות'}*\n`;
  let cat = '';
  for (const i of rows) {
    if (i.category !== cat) { cat = i.category; out += `\n*${CAT_EMOJI[cat] || ''} ${cat}*\n`; }
    const mark = { found: '✅', missing: '❌', partial: '🌓', check: '❓', need: '▫️' }[i.status];
    const q = i.qty !== 1 || i.unit ? ` ×${fmtQty(i.qty)}${i.unit ? ' ' + i.unit : ''}` : '';
    out += `${mark} ${i.name}${q}${i.note ? ` (${i.note})` : ''}\n`;
  }
  return out;
}

function MenuSheet({ list, items, id, me, wake, onWake, onClose, onRename, onNewTrip, onChangeName, say }) {
  const link = typeof window !== 'undefined' ? `${window.location.origin}/l/${id}` : '';
  const missing = items.filter((i) => i.status === 'missing' || i.status === 'partial');

  async function share() {
    const text = `בוא/י להצטרף לרשימת הקניות "${list?.name}" — כל מה שנמצא מתעדכן אצל כולם:\n${link}`;
    if (navigator.share) { try { await navigator.share({ title: list?.name, text }); return; } catch { return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }
  async function copy(t, msg) {
    try { await navigator.clipboard.writeText(t); say(msg); } catch { say('לא הצלחתי להעתיק'); }
  }
  const wa = (t) => window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');

  return (
    <Sheet onClose={onClose}>
      <h3>{list?.name}</h3>
      <div className="menu-list">
        <button onClick={share}><span className="ic">👥</span>הזמן את אשתי / משתתפים לרשימה</button>
        <button onClick={() => copy(link, 'הקישור הועתק')}><span className="ic">🔗</span>העתק קישור לרשימה</button>
        <button onClick={() => wa(listAsText(list, items, true))}><span className="ic">💬</span>שלח בוואטסאפ את מה שנשאר לקנות</button>
        {missing.length > 0 && (
          <button onClick={() => wa(`❌ *חסר ב${list?.name}:*\n` + missing.map((i) => `• ${i.name}${i.status === 'partial' ? ` (נמצאו ${fmtQty(i.found_qty || 0)}/${fmtQty(i.qty)})` : ''}`).join('\n'))}>
            <span className="ic">❌</span>שלח רשימת חסרים ({missing.length})
          </button>
        )}
        <button onClick={() => copy(listAsText(list, items, false), 'הרשימה הועתקה')}><span className="ic">📄</span>העתק את כל הרשימה כטקסט</button>
        <button onClick={() => onWake(!wake)}><span className="ic">{wake ? '🔆' : '🔅'}</span>המסך לא נכבה בזמן קנייה: {wake ? 'פועל' : 'כבוי'}</button>
        <button onClick={() => { const n = prompt('שם הרשימה', list?.name || ''); if (n) onRename(n); }}><span className="ic">✏️</span>שנה שם רשימה</button>
        <button onClick={onChangeName}><span className="ic">🙂</span>השם שלי: {me || '—'}</button>
        <button onClick={() => { if (confirm('קנייה חדשה: מה שנמצא יימחק, ומה שחסר יישאר לפעם הבאה. להמשיך?')) onNewTrip(false); }}>
          <span className="ic">🔄</span>קנייה חדשה (משאיר את מה שחסר)
        </button>
        <button style={{ color: 'var(--red)' }} onClick={() => { if (confirm('למחוק את כל הפריטים ברשימה?')) onNewTrip(true); }}>
          <span className="ic">🗑️</span>רוקן את כל הרשימה
        </button>
      </div>
    </Sheet>
  );
}

function NameSheet({ initial, onSave }) {
  const [n, setN] = useState(initial || '');
  return (
    <div className="sheet-bg">
      <div className="sheet">
        <div className="grab" />
        <h3>👋 איך קוראים לך?</h3>
        <div className="muted small" style={{ marginBottom: 10 }}>כדי שכולם יראו מי מצא מה ומי מחפש מה</div>
        <input className="input" value={n} onChange={(e) => setN(e.target.value)} autoFocus maxLength={30} placeholder="השם שלך"
          onKeyDown={(e) => { if (e.key === 'Enter' && n.trim()) onSave(n.trim()); }} />
        <button className="btn primary block" style={{ marginTop: 12 }} disabled={!n.trim()} onClick={() => onSave(n.trim())}>המשך</button>
      </div>
    </div>
  );
}
