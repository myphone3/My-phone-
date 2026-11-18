'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser, signInWithGoogle, GoogleButton } from '@/lib/auth';
import { api, errText } from '@/lib/api';
import { getCached, setCached, setLastShop, clearCached, pushList } from '@/lib/cache';
import { indexItem } from '@/lib/kb';
import { takeShared } from '@/lib/share';
import HomeView from './home';
import ItemView from './item';
import Editor from './editor';
import Importer from './importer';
import Team from './team';
import More from './more';
import Ask from './ask';
import Board, { isUnread } from './board';
import PostEditor from './post';
import Asks, { AskNew } from './asks';
import ImeiScan from '@/components/ImeiScan';

function merge(old, fresh) {
  const map = new Map(old.map((x) => [x.id, x]));
  for (const x of fresh) { if (x.deleted_at) map.delete(x.id); else map.set(x.id, x); }
  return [...map.values()];
}

export default function Shop({ params }) {
  const id = params.id;
  const user = useUser();
  const [data, setData] = useState(() => (typeof window !== 'undefined' ? getCached(id) : null));
  const [fatal, setFatal] = useState('');
  const [stack, setStack] = useState([]); // חלונות פתוחים: {t:'item'|'edit'|'import'|'team'|'more'|'ask', ...}
  const [toastMsg, setToastMsg] = useState('');
  const dataRef = useRef(data);
  dataRef.current = data;

  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(''), 2200); }, []);

  // ===== סנכרון =====
  const refresh = useCallback(async (full) => {
    const cur = dataRef.current;
    try {
      const since = !full && cur?.now ? cur.now : null;
      const r = await api.load(id, since);
      const next = since
        ? { now: r.now, shop: r.shop, tags: merge(cur.tags, r.tags), items: merge(cur.items, r.items), posts: merge(cur.posts || [], r.posts || []), asks: merge(cur.asks || [], r.asks || []) }
        : { now: r.now, shop: r.shop, tags: r.tags, items: r.items, posts: r.posts || [], asks: r.asks || [] };
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
    refresh(!dataRef.current);
    const tick = () => { if (document.visibilityState === 'visible') refresh(); };
    const t = setInterval(tick, 20000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('online', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); window.removeEventListener('online', tick); };
  }, [user, id, refresh]);

  // ===== חלונות + כפתור "חזור" של הטלפון =====
  const open = useCallback((w) => { history.pushState({ kb: true }, ''); setStack((s) => [...s, w]); }, []);
  const close = useCallback(() => history.back(), []);
  // מחליף את החלון העליון בלי להוסיף צעד אחורה (למשל אחרי שמירה: עורך ← פריט)
  const replace = useCallback((w) => setStack((s) => [...s.slice(0, -1), w]), []);
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // שיתוף מוואטסאפ / קישור עם ?add= / קובץ ייצוא צ'אט
  useEffect(() => {
    if (!data?.shop) return;
    const sp = new URLSearchParams(location.search);
    if (sp.has('add') || sp.has('import') || sp.has('shared') || sp.has('ask') || sp.has('board') || sp.has('asks')) history.replaceState(null, '', location.pathname);
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
    else if (sp.has('asks')) open({ t: 'asks' });
  }, [!!data?.shop]); // eslint-disable-line

  const tagsById = useMemo(() => Object.fromEntries((data?.tags || []).map((t) => [t.id, t])), [data?.tags]);
  const index = useMemo(() => {
    const m = new Map();
    for (const it of data?.items || []) m.set(it.id, indexItem(it, tagsById));
    return m;
  }, [data?.items, tagsById]);

  // עדכון מקומי מיידי אחרי שמירה
  const applyItem = useCallback((it) => {
    setData((d) => { const n = { ...d, items: merge(d.items, [it]) }; setCached(id, n); return n; });
  }, [id]);
  const applyTags = useCallback((list) => {
    setData((d) => { const n = { ...d, tags: merge(d.tags, list) }; setCached(id, n); return n; });
  }, [id]);
  const applyPost = useCallback((p) => {
    setData((d) => { const n = { ...d, posts: merge(d.posts || [], [p]) }; setCached(id, n); return n; });
  }, [id]);
  const applyAsk = useCallback((a) => {
    setData((d) => { const n = { ...d, asks: merge(d.asks || [], [a]) }; setCached(id, n); return n; });
  }, [id]);
  const markSeen = useCallback(() => {
    setData((d) => { const n = { ...d, shop: { ...d.shop, seen_at: new Date().toISOString() } }; setCached(id, n); return n; });
  }, [id]);
  const removeItem = useCallback((itemId) => {
    setData((d) => { const n = { ...d, items: d.items.filter((x) => x.id !== itemId) }; setCached(id, n); return n; });
  }, [id]);

  // יוצר תגיות חדשות (לפי שם) ומחזיר את כל המזהים
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
  if (!data?.shop) return <div className="reading"><div className="spin" /><div className="muted">טוען…</div></div>;

  const unread = (data.posts || []).filter((p) => isUnread(p, { user, shop: data.shop })).length;
  const ctx = {
    unread,
    shopId: id, shop: data.shop, tags: data.tags, tagsById, items: data.items, index, user, posts: data.posts || [],
    applyPost, markSeen, asks: data.asks || [], applyAsk,
    isAdmin: data.shop.role === 'owner' || data.shop.role === 'admin',
    open, close, replace, toast, refresh, applyItem, applyTags, removeItem, ensureTags,
    openItem: (it) => { pushList('recent_' + id, it.id, 15); open({ t: 'item', id: it.id }); },
  };

  return (
    <>
      <HomeView ctx={ctx} />
      {stack.map((w, i) => {
        const key = i + w.t;
        if (w.t === 'item') return <ItemView key={key} ctx={ctx} id={w.id} />;
        if (w.t === 'edit') return <Editor key={key} ctx={ctx} item={w.item} draft={w.draft} auto={w.auto} onDone={w.onDone} />;
        if (w.t === 'import') return <Importer key={key} ctx={ctx} file={w.file} />;
        if (w.t === 'team') return <Team key={key} ctx={ctx} />;
        if (w.t === 'more') return <More key={key} ctx={ctx} />;
        if (w.t === 'ask') return <Ask key={key} ctx={ctx} q0={w.q} />;
        if (w.t === 'asks') return <Asks key={key} ctx={ctx} />;
        if (w.t === 'ask-new') return <AskNew key={key} ctx={ctx} />;
        if (w.t === 'board') return <Board key={key} ctx={ctx} />;
        if (w.t === 'post') return <PostEditor key={key} ctx={ctx} post={w.post} kind={w.kind} />;
        if (w.t === 'scan') return <ImeiScan key={key} ctx={ctx} onPick={w.onPick} />;
        return null;
      })}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
