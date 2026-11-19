'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser, signInWithGoogle, GoogleButton, userName } from '@/lib/auth';
import { api, errText, serverCall } from '@/lib/api';
import { getCached, setCached, setLastShop, clearCached, pushList } from '@/lib/cache';
import { indexItem, live, shopTypes } from '@/lib/kb';
import { takeShared } from '@/lib/share';
import { MsgIcon, GearIcon } from '@/components/Icons';
import HomeView from './home';
import ItemView from './item';
import Editor from './editor';
import Importer from './importer';
import Team from './team';
import Settings from './more';
import Ask from './ask';
import Board from './board';
import PostEditor from './post';
import AsksTab, { AskNew } from './asks';
import { CategoryPage, CompanyPage } from './cat';
import StockTab, { StockReport, Supplier } from './stock';
import NotesTab, { NoteEditor } from './notes';
import Deals from './deals';
import { SeenSheet } from '@/components/Seen';
import { CustomerSend } from './item';
import ImeiScan from '@/components/ImeiScan';
import BarcodeScan from '@/components/BarcodeScan';

const LISTS = ['tags', 'items', 'posts', 'asks', 'stock', 'notes', 'deals', 'products', 'replies'];
const seenKey = (s) => s.ref + ':' + s.ref_id + ':' + s.user_id;

function merge(old, fresh) {
  const map = new Map((old || []).map((x) => [x.id, x]));
  for (const x of fresh || []) { if (x.deleted_at) map.delete(x.id); else map.set(x.id, x); }
  return [...map.values()];
}
function mergeSeen(old, fresh) {
  const map = new Map((old || []).map((x) => [seenKey(x), x]));
  for (const x of fresh || []) map.set(seenKey(x), x);
  return [...map.values()];
}

const TABS = [
  { k: 'home', e: '🏠', label: 'ראשי' },
  { k: 'stock', e: '📦', label: 'מלאי' },
  { k: 'notes', e: '📌', label: 'פתוחים' },
  { k: 'asks', e: '💬', label: 'שאלות' },
];

export default function Shop({ params }) {
  const id = params.id;
  const user = useUser();
  const [data, setData] = useState(() => (typeof window !== 'undefined' ? getCached(id) : null));
  const [fatal, setFatal] = useState('');
  const [stack, setStack] = useState([]);
  const [tab, setTabState] = useState(() => { try { return sessionStorage.getItem('kb_tab2') || 'home'; } catch { return 'home'; } });
  const [toastMsg, setToastMsg] = useState('');
  const dataRef = useRef(data);
  dataRef.current = data;
  const seenBusy = useRef(new Set());

  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(''), 2400); }, []);
  const setTab = useCallback((t) => { setTabState(t); try { sessionStorage.setItem('kb_tab2', t); } catch {} window.scrollTo(0, 0); }, []);

  // ===== סנכרון =====
  const refresh = useCallback(async (full) => {
    const cur = dataRef.current;
    try {
      const since = !full && cur?.now && cur.v === 5 ? cur.now : null;
      const r = await api.load(id, since);
      const next = { v: 5, now: r.now, shop: r.shop, members: r.members || [] };
      for (const k of LISTS) next[k] = since ? merge(cur[k], r[k]) : r[k] || [];
      next.seen = since ? mergeSeen(cur.seen, r.seen) : r.seen || [];
      setData(next); setCached(id, next); setFatal('');
    } catch (e) {
      const m = errText(e);
      if (/גישה|להתחבר/.test(m)) { setFatal(m); clearCached(id); setLastShop(''); }
      else if (!cur) setFatal(m);
    }
  }, [id]);

  useEffect(() => {
    if (!user) return;
    setLastShop(id);
    refresh(!dataRef.current || dataRef.current.v !== 5);
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const t = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); };
  }, [user, id, refresh]);

  // ===== חלונות + כפתור "חזור" של הטלפון =====
  const open = useCallback((w) => { history.pushState({ kb: true }, ''); setStack((s) => [...s, w]); }, []);
  const close = useCallback(() => history.back(), []);
  const replace = useCallback((w) => setStack((s) => [...s.slice(0, -1), w]), []);
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // קישורים מהתראות / שיתוף מוואטסאפ
  useEffect(() => {
    if (!data?.shop) return;
    const sp = new URLSearchParams(location.search);
    if ([...sp.keys()].length) history.replaceState(null, '', location.pathname);
    if (sp.has('shared')) {
      takeShared().then((s) => {
        if (!s) return;
        if (s.file) open({ t: 'import', file: s.file });
        else if (s.text) open({ t: 'edit', draft: { body: s.text, source: 'share' }, auto: true });
      });
    } else if (sp.has('add')) open({ t: 'edit', draft: { body: sp.get('add') || '' }, auto: !!sp.get('add') });
    else if (sp.has('import')) open({ t: 'import' });
    else if (sp.has('ask')) open({ t: 'ask' });
    else if (sp.has('board')) open({ t: 'board' });
    else if (sp.has('asks')) setTab('asks');
    else if (sp.has('notes')) setTab('notes');
    else if (sp.has('stock')) setTab('stock');
  }, [!!data?.shop]); // eslint-disable-line

  const tagsById = useMemo(() => Object.fromEntries((data?.tags || []).map((t) => [t.id, t])), [data?.tags]);
  const index = useMemo(() => {
    const m = new Map();
    for (const it of data?.items || []) m.set(it.id, indexItem(it, tagsById));
    return m;
  }, [data?.items, tagsById]);

  // עדכון מקומי מיידי אחרי שמירה
  const apply = useCallback((key, rows) => {
    setData((d) => { const n = { ...d, [key]: merge(d[key], Array.isArray(rows) ? rows : [rows]) }; setCached(id, n); return n; });
  }, [id]);
  const applyItem = useCallback((it) => apply('items', it), [apply]);
  const applyTags = useCallback((list) => apply('tags', list), [apply]);
  const removeItem = useCallback((itemId) => {
    setData((d) => { const n = { ...d, items: d.items.filter((x) => x.id !== itemId) }; setCached(id, n); return n; });
  }, [id]);
  const setShop = useCallback((patch) => {
    setData((d) => { const n = { ...d, shop: { ...d.shop, ...patch } }; setCached(id, n); return n; });
  }, [id]);

  // "ראיתי": מסמן בשרת את כל מה שעוד לא ראיתי (לא שלי)
  const markSeen = useCallback((ref, rows, authorKey) => {
    const d = dataRef.current;
    const me = user?.id;
    if (!d || !me) return;
    const have = new Set((d.seen || []).filter((s) => s.ref === ref && s.user_id === me).map((s) => s.ref_id));
    const ids = rows.filter((x) => x[authorKey] !== me && !have.has(x.id) && !seenBusy.current.has(ref + x.id)).map((x) => x.id);
    if (!ids.length) return;
    ids.forEach((x) => seenBusy.current.add(ref + x));
    api.markSeen(id, ref, ids).then(() => {
      const at = new Date().toISOString();
      setData((dd) => { const n = { ...dd, seen: mergeSeen(dd.seen, ids.map((x) => ({ ref, ref_id: x, user_id: me, name: userName(user), at }))) }; setCached(id, n); return n; });
    }).catch(() => {}).finally(() => ids.forEach((x) => seenBusy.current.delete(ref + x)));
  }, [id, user]);

  const ensureTags = useCallback(async (tagIds, newTags) => {
    const ids = [...tagIds];
    const created = [];
    for (const nt of newTags || []) {
      const t = await api.saveTag(id, nt);
      created.push(t);
      if (!ids.includes(t.id)) ids.push(t.id);
    }
    if (created.length) applyTags(created);
    return ids;
  }, [id, applyTags]);

  if (user === null) return (
    <div className="wrap"><div className="hero"><div className="logo">🗂️</div><h1>מידע לחנות</h1><div className="muted">צריך להתחבר כדי לראות את המידע</div></div>
      <GoogleButton onClick={() => signInWithGoogle()} /></div>
  );
  if (fatal) return (
    <div className="wrap"><div className="empty"><div className="e">🔒</div><b>{fatal}</b>
      <div style={{ marginTop: 16 }}><a className="btn" href="/?all">לרשימת החנויות</a></div></div></div>
  );
  if (!data?.shop || data.v !== 5) return <div className="reading"><div className="spin" /><div className="muted">טוען…</div></div>;

  const me = user?.id;
  const seen = data.seen || [];
  const seenOf = (ref, rid) => seen.filter((s) => s.ref === ref && s.ref_id === rid);
  const iSaw = (ref, rid) => seen.some((s) => s.ref === ref && s.ref_id === rid && s.user_id === me);
  const posts = data.posts || [];
  const urgentWaiting = posts.filter((p) => !p.deleted_at && p.urgent && p.author_id !== me && !iSaw('post', p.id) && new Date(p.created_at) > Date.now() - 2 * 86400000);
  const unread = posts.filter((p) => !p.deleted_at && p.author_id !== me && !iSaw('post', p.id) && new Date(p.created_at) > Date.now() - 14 * 86400000).length;
  const stockOpen = (data.stock || []).filter((x) => x.status === 'out' || x.status === 'low');
  const notesOpen = (data.notes || []).filter((x) => x.status !== 'done');
  const asksWaiting = (data.asks || []).filter((a) => !a.deleted_at && a.status === 'open' && a.asked_by !== me && !(a.answers || []).length);

  const ctx = {
    shopId: id, shop: data.shop, user, me, myName: userName(user),
    tags: data.tags, tagsById, items: data.items, index, members: data.members || [],
    categories: live(data.tags, 'category'), companies: live(data.tags, 'company'), types: shopTypes(data.shop),
    posts, asks: data.asks || [], stock: data.stock || [], notes: data.notes || [], deals: data.deals || [], products: data.products || [], replies: data.replies || [],
    seen, seenOf, iSaw, markSeen, urgentWaiting, unread, stockOpen, notesOpen, asksWaiting,
    isAdmin: data.shop.role === 'owner' || data.shop.role === 'admin',
    open, close, replace, toast, refresh, apply, applyItem, applyTags, removeItem, ensureTags, setShop, setTab, tab,
    applyPost: (p) => apply('posts', p), applyAsk: (a) => apply('asks', a),
    notify: (body) => serverCall('/api/notify', { shop: id, ...body }).catch(() => {}),
    openItem: (it) => { pushList('recent_' + id, it.id, 15); open({ t: 'item', id: it.id }); },
  };

  const badge = { stock: stockOpen.length, notes: notesOpen.length, asks: asksWaiting.length };
  return (
    <>
      <div className="wrap">
        <div className="top">
          <div className="hdr">
            {data.shop.logo_url ? <img className="shop-logo" src={data.shop.logo_url} alt="" onClick={() => setTab('home')} />
              : <div className="shop-logo ini" onClick={() => setTab('home')}>{(data.shop.name || '?').charAt(0)}</div>}
            <h1 className="title grow" onClick={() => setTab('home')}>{TABS.find((t) => t.k === tab && t.k !== 'home')?.label || data.shop.name}</h1>
            <button className="icon-btn line" aria-label="הודעות" onClick={() => open({ t: 'board' })}><MsgIcon />{unread > 0 && <span className="dot">{unread}</span>}</button>
            <button className="icon-btn line" aria-label="הגדרות" onClick={() => open({ t: 'settings' })}><GearIcon />{ctx.isAdmin && data.shop.pending > 0 && <span className="dot">{data.shop.pending}</span>}</button>
          </div>
        </div>
        {tab === 'stock' ? <StockTab ctx={ctx} /> : tab === 'notes' ? <NotesTab ctx={ctx} /> : tab === 'asks' ? <AsksTab ctx={ctx} /> : <HomeView ctx={ctx} />}
      </div>
      <nav className="nav">
        <div className="nav-in">
          {TABS.map((t) => (
            <button key={t.k} className={tab === t.k ? 'on' : ''} onClick={() => setTab(t.k)}>
              <span className="e">{t.e}</span>{t.label}
              {badge[t.k] > 0 && <span className={'dot nb-' + t.k}>{badge[t.k]}</span>}
            </button>
          ))}
        </div>
      </nav>
      {stack.map((w, i) => {
        const key = i + w.t;
        if (w.t === 'item') return <ItemView key={key} ctx={ctx} id={w.id} />;
        if (w.t === 'edit') return <Editor key={key} ctx={ctx} item={w.item} draft={w.draft} auto={w.auto} onDone={w.onDone} />;
        if (w.t === 'import') return <Importer key={key} ctx={ctx} file={w.file} />;
        if (w.t === 'team') return <Team key={key} ctx={ctx} />;
        if (w.t === 'settings') return <Settings key={key} ctx={ctx} view={w.view} edit={w.edit} />;
        if (w.t === 'ask') return <Ask key={key} ctx={ctx} q0={w.q} />;
        if (w.t === 'ask-new') return <AskNew key={key} ctx={ctx} kind={w.kind} text={w.text} />;
        if (w.t === 'board') return <Board key={key} ctx={ctx} />;
        if (w.t === 'post') return <PostEditor key={key} ctx={ctx} post={w.post} />;
        if (w.t === 'cat') return <CategoryPage key={key} ctx={ctx} catId={w.id} />;
        if (w.t === 'co') return <CompanyPage key={key} ctx={ctx} coId={w.id} catId={w.cat} />;
        if (w.t === 'report') return <StockReport key={key} ctx={ctx} name={w.name} companyId={w.company_id} fromNote={w.fromNote} />;
        if (w.t === 'supplier') return <Supplier key={key} ctx={ctx} />;
        if (w.t === 'note') return <NoteEditor key={key} ctx={ctx} note={w.note} />;
        if (w.t === 'deals') return <Deals key={key} ctx={ctx} />;
        if (w.t === 'seen') return <SeenSheet key={key} ctx={ctx} refType={w.ref} row={w.row} authorId={w.authorId} title={w.title} />;
        if (w.t === 'cust') return <CustomerSend key={key} ctx={ctx} id={w.id} />;
        if (w.t === 'scan') return <ImeiScan key={key} ctx={ctx} onPick={w.onPick} />;
        if (w.t === 'barcode') return <BarcodeScan key={key} ctx={ctx} onPick={w.onPick} />;
        return null;
      })}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
