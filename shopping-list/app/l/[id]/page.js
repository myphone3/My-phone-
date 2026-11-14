'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CAT_EMOJI } from '@/lib/catalog';
import { parseText, fmtQty } from '@/lib/parse';
import { getMyName, setMyName, rememberList, getPref, setPref } from '@/lib/local';
import { catOrderOf, assigneeOf, currentStore, keyOf, shekel, unitPrice } from '@/lib/order';
import {
  ItemSheet, PasteSheet, MenuSheet, NameSheet, SplitSheet, StoreSheet, STATUS, colorFor,
} from './sheets';
import { ReceiptSheet, TripsSheet } from './receipt';
import { enTermFor } from '@/lib/parse';

const STATUS_RANK = { need: 0, check: 1, partial: 2, missing: 3, found: 4 };

const FILTERS = [
  ['all', 'הכל'], ['mine', 'שלי'], ['left', 'נשאר'], ['check', 'לבדיקה'], ['missing', 'חסר'], ['found', 'נמצא'],
];

export default function ListPage() {
  const { id } = useParams();
  const router = useRouter();
  const [list, setList] = useState(null);
  const [items, setItems] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState('');
  const [askName, setAskName] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [paste, setPaste] = useState(null); // { text, ai } או null
  const [sheet, setSheet] = useState(null); // 'menu' | 'split' | 'store' | 'trips' | 'receipt'
  const [quick, setQuick] = useState('');
  const [toast, setToast] = useState('');
  const [people, setPeople] = useState([]);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [wake, setWake] = useState(false);
  const [listening, setListening] = useState(false);
  const chan = useRef(null);
  const toastT = useRef(null);
  const meRef = useRef('');
  const recRef = useRef(null);

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

  const loadPrices = useCallback(async () => {
    const { data } = await supabase.rpc('sl_price_history', { p_list: id });
    if (data) setPrices(data);
  }, [id]);

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
    loadPrices();

    const ch = supabase.channel(`sl:${id}`, { config: { broadcast: { self: false }, presence: { key: n || 'אורח' } } });
    ch.on('broadcast', { event: 'change' }, ({ payload }) => {
      if (payload.rows) applyRows(payload.rows);
      if (payload.deleted) setItems((p) => p.filter((i) => !payload.deleted.includes(i.id)));
      if (payload.reload) { load(); loadPrices(); }
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
  }, [id, load, loadPrices, applyRows, say]);

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

  // תמונה אוטומטית לפריטים שהוספתי (אחד בכל פעם, כדי לא להעמיס)
  const imgTried = useRef(new Set());
  useEffect(() => {
    if (!me || loading) return;
    const next = items.find((i) => !i.image_url && !i.photo_url && i.added_by === me && i.status !== 'found' && !imgTried.current.has(i.id));
    if (!next) return;
    imgTried.current.add(next.id);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/image?q=${encodeURIComponent(next.name)}&en=${encodeURIComponent(enTermFor(next.name) || '')}`);
        const j = await r.json();
        const img = j.source === 'openfoodfacts' && j.images?.[0]?.thumb;
        if (img) update(next, { image_url: img });
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, me, loading]);

  const broadcast = (payload) => chan.current?.send({ type: 'broadcast', event: 'change', payload: { ...payload, by: meRef.current } });

  // התראה לטלפונים של האחרים (רק לדברים חשובים, לא על כל סימון)
  const notify = (text) => {
    fetch('/api/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: id, by: meRef.current, title: list?.name || 'רשימת קניות', text }),
    }).catch(() => {});
  };

  async function updateList(patch, msg) {
    setList((l) => ({ ...l, ...patch }));
    const { data, error } = await supabase.rpc('sl_update_list', { p_list: id, p: patch });
    if (error) { say('לא נשמר — בדוק אינטרנט'); load(); return; }
    if (data) setList(data);
    if (patch.name) rememberList(id, patch.name);
    broadcast({ list: patch, msg });
  }

  async function addParsed(parsed) {
    if (!parsed.length) return;
    const payload = parsed.map(({ en, ...rest }) => rest);
    const { data, error } = await supabase.rpc('sl_add_items', { p_list: id, p_items: payload, p_by: me });
    if (error) return say('שגיאה בהוספה, נסה שוב');
    applyRows(data);
    const what = parsed.length === 1 ? parsed[0].name : parsed.length + ' פריטים';
    broadcast({ rows: data, msg: `${me || 'מישהו'} הוסיף ${what}` });
    notify(`${me || 'מישהו'} הוסיף ${parsed.length <= 3 ? parsed.map((p) => p.name).join(', ') : what}`);
    say(parsed.length === 1 ? `נוסף: ${parsed[0].name}` : `נוספו ${parsed.length} פריטים`);
  }

  async function update(item, patch, msg, push) {
    const optimistic = { ...item, ...patch, updated_at: new Date().toISOString() };
    applyRows([optimistic]);
    const { data, error } = await supabase.rpc('sl_update_item', { p_list: id, p_item: item.id, p: patch });
    if (error || !data) { say('לא נשמר — בדוק אינטרנט'); load(); return; }
    applyRows([data]);
    broadcast({ rows: [data], msg });
    if (push && msg) notify(msg);
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
    if (parsed.length > 1) { setPaste({ text: t }); setQuick(''); return; }
    addParsed(parsed);
    setQuick('');
  }

  // הקלטה קולית: "חלב לחם ושתי עגבניות" → רשימה
  function voice() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return say('הדפדפן הזה לא תומך בהקלטה. נסה בכרום, או במקלדת לחץ על המיקרופון');
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'he-IL';
    rec.interimResults = false;
    rec.continuous = true;
    let text = '';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += ' ' + e.results[i][0].transcript;
    };
    rec.onerror = (e) => { if (e.error === 'not-allowed') say('צריך לאשר גישה למיקרופון'); };
    rec.onend = () => {
      setListening(false);
      if (text.trim()) setPaste({ text: text.trim(), ai: true });
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
    say('🎤 מקשיב… אמור את הפריטים ולחץ שוב לסיום');
  }

  const order = useMemo(() => catOrderOf(list), [list]);
  const store = currentStore(list);

  // מחיר קודם לכל מוצר
  const lastPrice = useCallback((name) => prices[keyOf(name)]?.[0] || null, [prices]);

  const counts = useMemo(() => {
    const c = { total: items.length, found: 0, missing: 0, check: 0, partial: 0, mine: 0, price: 0, prevSame: 0, nowSame: 0 };
    for (const i of items) {
      if (i.status === 'found') c.found++;
      if (i.status === 'missing') c.missing++;
      if (i.status === 'check') c.check++;
      if (i.status === 'partial') c.partial++;
      if (i.status !== 'found' && (i.claimed_by === me || assigneeOf(i, list) === me)) c.mine++;
      if (i.price) {
        c.price += Number(i.price);
        const lp = lastPrice(i.name);
        if (lp) { c.nowSame += Number(i.price); c.prevSame += unitPrice(lp.price, lp.qty) * Number(i.found_qty || i.qty || 1); }
      }
    }
    return c;
  }, [items, me, list, lastPrice]);

  const groups = useMemo(() => {
    const f = items.filter((i) => {
      if (filter === 'left') return i.status === 'need' || i.status === 'partial' || i.status === 'check';
      if (filter === 'found') return i.status === 'found';
      if (filter === 'missing') return i.status === 'missing' || i.status === 'partial';
      if (filter === 'check') return i.status === 'check';
      if (filter === 'mine') return i.status !== 'found' && (i.claimed_by === me || assigneeOf(i, list) === me);
      return true;
    });
    f.sort((a, b) =>
      (order[a.category] ?? 99) - (order[b.category] ?? 99) ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      a.created_at.localeCompare(b.created_at));
    const g = [];
    for (const i of f) {
      if (!g.length || g[g.length - 1].cat !== i.category) g.push({ cat: i.category, items: [] });
      g[g.length - 1].items.push(i);
    }
    return g;
  }, [items, filter, me, list, order]);

  // כל מי שמשתתף: מחוברים עכשיו + מי שהוסיף/מצא + מי שקיבל חלק
  const participants = useMemo(() => {
    const s = new Set(people);
    if (me) s.add(me);
    for (const i of items) { if (i.added_by) s.add(i.added_by); if (i.done_by) s.add(i.done_by); if (i.assigned_to) s.add(i.assigned_to); }
    for (const v of Object.values(list?.assignments || {})) if (v) s.add(v);
    return [...s];
  }, [people, me, items, list]);

  const pending = items.filter((i) => i.status === 'check' && i.photo_url);
  const open = items.find((i) => i.id === openId);
  const pct = counts.total ? Math.round((counts.found / counts.total) * 100) : 0;
  const diff = counts.prevSame ? counts.nowSame - counts.prevSame : 0;

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
              {store && <button className="small" style={{ fontWeight: 700, color: 'var(--green)' }} onClick={() => setSheet('store')}>📍 {store.name} · </button>}
              {counts.found}/{counts.total} נמצאו
              {counts.missing > 0 && ` · ${counts.missing} חסרים`}
              {counts.price > 0 && ` · ${shekel(counts.price)}`}
              {Math.abs(diff) >= 1 && (
                <span style={{ color: diff > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                  {' '}({diff > 0 ? '+' : '−'}{shekel(Math.abs(diff))} מהפעם הקודמת)
                </span>
              )}
            </div>
          </div>
          <div className="people" title={people.join(', ')}>
            {people.slice(0, 4).map((p) => (
              <div key={p} className="avatar" style={{ background: colorFor(p) }}>{p[0]}</div>
            ))}
          </div>
          <button className="icon-btn" onClick={() => setSheet('menu')} aria-label="תפריט">⋯</button>
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
          <button className="chip" onClick={() => setSheet('split')}>👥 חלוקה</button>
        </div>
      </div>

      {pending.map((i) => (
        <div key={i.id} className="alert">
          <img src={i.photo_url} alt="" onClick={() => setViewPhoto(i.photo_url)} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{i.done_by || 'מישהו'} שואל: זה ה{i.name} הנכון?</div>
            {i.note && <div className="small muted">{i.note}</div>}
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm primary" onClick={() => update(i, { status: 'found' }, `👍 ${me}: כן, זה ה${i.name} הנכון`, true)}>כן, קח</button>
              <button className="btn sm" onClick={() => update(i, { status: 'need', photo_url: null }, `👎 ${me}: לא, זה לא ה${i.name} הנכון`, true)}>לא</button>
            </div>
          </div>
        </div>
      ))}

      {!loading && counts.total > 0 && counts.found + counts.missing === counts.total && (
        <div className="alert" style={{ background: 'var(--green-soft)' }}>
          <div style={{ fontSize: 34 }}>🎉</div>
          <div className="grow">
            <div style={{ fontWeight: 800 }}>סיימתם את הרשימה!</div>
            <div className="small muted">צלמו את החשבונית — המחירים של כל מוצר יישמרו להשוואה בפעם הבאה</div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm primary" onClick={() => setSheet('receipt')}>🧾 צלם חשבונית</button>
              <button className="btn sm" onClick={() => setSheet('menu')}>🔄 קנייה חדשה</button>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="empty"><div className="big">⏳</div></div>}
      {!loading && items.length === 0 && (
        <div className="empty">
          <div className="big">📝</div>
          <p style={{ fontWeight: 700, color: 'var(--ink)' }}>הרשימה ריקה</p>
          <p>כתוב פריט למטה, הקלט בקול 🎤, או הדבק רשימה שלמה מהוואטסאפ — נסדר אותה לפי מחלקות.</p>
          <button className="btn primary" onClick={() => setPaste({ text: '' })}>📋 הדבק רשימה</button>
        </div>
      )}
      {!loading && items.length > 0 && groups.length === 0 && (
        <div className="empty">{filter === 'mine' ? 'אין לך כרגע פריטים. אפשר לחלק את הרשימה ב"👥 חלוקה"' : 'אין פריטים בסינון הזה'}</div>
      )}

      {groups.map((g) => {
        const who = list?.assignments?.[g.cat];
        return (
          <div key={g.cat}>
            <div className="cat">
              {CAT_EMOJI[g.cat] || '🛒'} {g.cat} <span className="count">{g.items.length}</span>
              <span className="grow" />
              <button className="badge b-claim" style={who ? { background: colorFor(who), color: '#fff' } : {}} onClick={() => setSheet('split')}>
                {who ? `👤 ${who === me ? 'אני' : who}` : '+ מי מביא?'}
              </button>
            </div>
            {g.items.map((i) => (
              <ItemRow key={i.id} item={i} me={me} list={list} last={lastPrice(i.name)}
                onOpen={() => setOpenId(i.id)} onToggle={() => toggleFound(i)} onPhoto={(u) => setViewPhoto(u)} />
            ))}
          </div>
        );
      })}

      <div className="addbar">
        <div className="in">
          <button className="icon-btn" onClick={() => setPaste({ text: '' })} aria-label="הדבק רשימה">📋</button>
          <input className="input grow" value={quick} placeholder="הוסף פריט… (למשל: 2 חלב)"
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') quickAdd(); }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (t.includes('\n')) { e.preventDefault(); setPaste({ text: t }); }
            }} />
          {quick.trim() ? (
            <button className="icon-btn" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--green)' }} onClick={quickAdd} aria-label="הוסף">+</button>
          ) : (
            <button className="icon-btn" style={listening ? { background: 'var(--red)', color: '#fff', borderColor: 'var(--red)' } : {}} onClick={voice} aria-label="הקלטה קולית">
              {listening ? '⏹' : '🎤'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <ItemSheet item={open} me={me} listId={id} list={list} participants={participants} history={prices[keyOf(open.name)] || []}
          onClose={() => setOpenId(null)} onUpdate={(patch, msg, push) => update(open, patch, msg, push)} onDelete={() => remove(open)} say={say} />
      )}
      {paste && (
        <PasteSheet initial={paste.text} ai={paste.ai} listId={id} onClose={() => setPaste(null)}
          onAdd={(parsed) => { addParsed(parsed); setPaste(null); }} />
      )}
      {sheet === 'menu' && (
        <MenuSheet list={list} items={items} id={id} me={me} wake={wake} store={store}
          onWake={(v) => { setWake(v); setPref('wake', v); }}
          onClose={() => setSheet(null)} say={say} open={setSheet}
          onRename={(n) => updateList({ name: n })}
          onNewTrip={async (all) => {
            await supabase.rpc('sl_new_trip', { p_list: id, p_clear_all: all });
            await load(); await loadPrices();
            broadcast({ reload: true, msg: `${me} התחיל קנייה חדשה` });
            setSheet(null);
            say('הקנייה נשמרה בהיסטוריה 👍');
          }}
          onChangeName={() => { setSheet(null); setAskName(true); }} />
      )}
      {sheet === 'split' && (
        <SplitSheet list={list} items={items} me={me} participants={participants} onClose={() => setSheet(null)}
          onSave={(assignments, msg) => updateList({ assignments }, msg)} notify={notify} />
      )}
      {sheet === 'store' && (
        <StoreSheet list={list} onClose={() => setSheet(null)} onSave={(patch) => updateList(patch)} />
      )}
      {sheet === 'trips' && <TripsSheet listId={id} onClose={() => setSheet(null)} onReceipt={() => setSheet('receipt')} />}
      {sheet === 'receipt' && (
        <ReceiptSheet listId={id} list={list} items={items} prices={prices} me={me} say={say} onClose={() => setSheet(null)}
          onSaved={async (total) => {
            setSheet(null);
            await load(); await loadPrices();
            const msg = `🧾 ${me} צילם חשבונית${total ? ` — ${shekel(total)}` : ''}`;
            broadcast({ reload: true, msg });
            notify(msg);
            say('המחירים נשמרו 👍 אפשר להשוות ב"קניות קודמות"');
          }} />
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
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span>{item.emoji || CAT_EMOJI[item.category] || '🛒'}</span>}
    </div>
  );
}

function ItemRow({ item, me, list, last, onOpen, onToggle, onPhoto }) {
  const st = STATUS[item.status];
  const who = item.assigned_to; // חלוקה ברמת הפריט (מעבר לחלוקה לפי מחלקה)
  let cmp = null;
  if (item.price && last) {
    const now = unitPrice(item.price, item.found_qty || item.qty), prev = unitPrice(last.price, last.qty);
    if (prev && Math.abs(now - prev) / prev >= 0.03) cmp = now > prev ? 'up' : 'down';
  }
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
          {who && item.status !== 'found' && (
            <span className="badge" style={{ background: colorFor(who), color: '#fff' }}>👤 {who === me ? 'אני' : who}</span>
          )}
          {item.claimed_by && item.status !== 'found' && (
            <span className="badge b-claim">🔎 {item.claimed_by === me ? 'אני מחפש' : item.claimed_by + ' מחפש'}</span>
          )}
          {item.price ? (
            <span style={cmp ? { color: cmp === 'up' ? 'var(--red)' : 'var(--green)', fontWeight: 700 } : {}}>
              {shekel(item.price)}{cmp === 'up' ? ' ▲' : cmp === 'down' ? ' ▼' : ''}
            </span>
          ) : last ? (
            <span>פעם קודמת {shekel(last.price)}{last.qty && Number(last.qty) !== 1 ? ` ל-${fmtQty(last.qty)}` : ''}</span>
          ) : null}
          {item.note && <span>{item.note}</span>}
        </div>
      </div>
      <button className={'check ' + st.cls} onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="סמן כנמצא">
        {st.icon}
      </button>
    </div>
  );
}
