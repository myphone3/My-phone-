'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { TYPES, KINDS, typeOf, queryWords, score, imeiInfo, norm, copyText } from '@/lib/kb';
import { getList } from '@/lib/cache';
import ItemRow, { Gallery } from '@/components/ItemRow';
import { api } from '@/lib/api';
import { kindOf, isUnread } from './board';
import { needsAnswer } from './asks';

const TABS = [{ k: 'all', label: 'ראשי' }, ...KINDS.map((x) => ({ k: x.k, label: x.label })), { k: 'type', label: 'סוגים' }];

export default function HomeView({ ctx }) {
  const { shop, tags, tagsById, items, index, open, openItem, isAdmin } = ctx;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('kb_tab') || 'all'; } catch { return 'all'; } });
  const [sel, setSel] = useState([]); // תגיות נבחרות (כולן חייבות להתאים)
  const [type, setType] = useState('');
  const [limit, setLimit] = useState(60);
  const [photosOnly, setPhotosOnly] = useState(false);
  const [view, setView] = useState(() => { try { return localStorage.getItem('kb_view') || 'list'; } catch { return 'list'; } });
  const setViewKeep = (v) => { setView(v); try { localStorage.setItem('kb_view', v); } catch {} };
  const missed = useRef(new Set());
  const inputRef = useRef(null);
  useEffect(() => { try { sessionStorage.setItem('kb_tab', tab); } catch {} }, [tab]);
  useEffect(() => setLimit(60), [q, sel, type, photosOnly]);

  const live = useMemo(() => tags.filter((t) => !t.deleted_at), [tags]);
  const counts = useMemo(() => {
    const c = {};
    for (const it of items) for (const t of it.tag_ids || []) c[t] = (c[t] || 0) + 1;
    return c;
  }, [items]);
  const typeCounts = useMemo(() => { const c = {}; for (const it of items) c[it.type] = (c[it.type] || 0) + 1; return c; }, [items]);

  const filtering = !!(q.trim() || sel.length || type || photosOnly);
  const imei = imeiInfo(q);

  const results = useMemo(() => {
    if (!filtering) return [];
    const words = queryWords(q);
    const numQ = q.replace(/\D/g, '');
    const out = [];
    for (const it of items) {
      if (type && it.type !== type) continue;
      if (photosOnly && !it.photos?.length) continue;
      if (sel.length && !sel.every((t) => it.tag_ids?.includes(t))) continue;
      let s = 1;
      if (words.length) {
        // חיפוש מילה שהיא שם של תגית — גם לפי התגית
        s = score(index.get(it.id), words, numQ);
        if (!s) continue;
      }
      out.push([s + (it.pinned ? 0.5 : 0), it]);
    }
    out.sort((a, b) => b[0] - a[0] || new Date(b[1].updated_at) - new Date(a[1].updated_at));
    return out.map((x) => x[1]);
  }, [filtering, q, sel, type, photosOnly, items, index]);

  // חיפוש שלא מצא כלום — נרשם ל"חסר במאגר" (אחרי שהפסיקו להקליד)
  useEffect(() => {
    const qq = q.trim();
    if (qq.length < 3 || results.length || imeiInfo(qq)) return;
    const t = setTimeout(() => { if (!missed.current.has(qq)) { missed.current.add(qq); api.miss(ctx.shopId, qq).catch(() => {}); } }, 2500);
    return () => clearTimeout(t);
  }, [q, results.length]); // eslint-disable-line

  // תגיות שמופיעות בתוצאות — לצמצום נוסף
  const related = useMemo(() => {
    if (!filtering) return [];
    const c = {};
    for (const it of results) for (const t of it.tag_ids || []) if (!sel.includes(t)) c[t] = (c[t] || 0) + 1;
    return Object.entries(c).filter(([t]) => tagsById[t]).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t, n]) => ({ t: tagsById[t], n }));
  }, [results, sel, filtering, tagsById]);

  // תגיות שהשם שלהן מתאים למה שמקלידים
  const tagHits = useMemo(() => {
    const w = norm(q);
    if (w.length < 2) return [];
    return live.filter((t) => !sel.includes(t.id) && norm(t.name).includes(w)).slice(0, 6);
  }, [q, live, sel]);

  const pinned = useMemo(() => items.filter((x) => x.pinned).sort((a, b) => a.title.localeCompare(b.title, 'he')), [items]);
  const recentIds = getList('recent_' + ctx.shopId);
  const recentOpened = recentIds.map((id) => items.find((x) => x.id === id)).filter(Boolean).slice(0, 5);
  const latest = useMemo(() => [...items].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 8), [items]);

  const pick = (t) => { setSel((s) => (s.includes(t.id) ? s.filter((x) => x !== t.id) : [...s, t.id])); setQ(''); window.scrollTo(0, 0); };
  const clearAll = () => { setQ(''); setSel([]); setType(''); setPhotosOnly(false); };

  const tile = (t) => (
    <button key={t.id} className="card tile" onClick={() => pick(t)}>
      <span className="e">{t.emoji || KINDS.find((k) => k.k === t.kind)?.e}</span>
      <b>{t.name}</b>
      <span>{counts[t.id] || 0} פריטים</span>
    </button>
  );

  function browse() {
    if (tab === 'type') return (
      <div className="grid" style={{ marginTop: 12 }}>
        {TYPES.map((t) => (
          <button key={t.k} className="card tile" onClick={() => { setType(t.k); window.scrollTo(0, 0); }}>
            <span className="e">{t.e}</span><b>{t.label}</b><span>{typeCounts[t.k] || 0} פריטים</span>
          </button>
        ))}
        <button className="card tile" onClick={() => { setPhotosOnly(true); setViewKeep('gallery'); window.scrollTo(0, 0); }}>
          <span className="e">🖼️</span><b>עם תמונות</b><span>{items.filter((x) => x.photos?.length).length} פריטים</span>
        </button>
      </div>
    );
    if (tab === 'device') {
      const devs = live.filter((t) => t.kind === 'device');
      if (!devs.length) return <div className="empty"><div className="e">📱</div>עוד אין מכשירים. הם נוספים לבד כשמוסיפים מידע על דגם מסוים.</div>;
      const groups = {};
      for (const d of devs) (groups[d.parent_id || ''] ||= []).push(d);
      return Object.entries(groups).sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1)).map(([p, list]) => (
        <div key={p}>
          <div className="h2">{p ? tagsById[p]?.name : 'אחר'}</div>
          <div className="grid">{list.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map(tile)}</div>
        </div>
      ));
    }
    if (tab === 'company' || tab === 'topic') {
      const list = live.filter((t) => t.kind === tab).sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.sort - b.sort);
      return <div className="grid" style={{ marginTop: 12 }}>{list.map(tile)}</div>;
    }
    // ראשי
    const topCompanies = live.filter((t) => t.kind === 'company').sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 10);
    const topTopics = live.filter((t) => t.kind === 'topic').sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).slice(0, 12);
    return (
      <>
        {!items.length && (
          <div className="card pad" style={{ marginTop: 14 }}>
            <b>👋 ברוך הבא! איך מתחילים?</b>
            <div className="muted" style={{ margin: '6px 0 12px' }}>אפשר להוסיף מידע אחד-אחד, או להעביר בבת אחת את כל מה שרשמת בצ'אט בוואטסאפ — והמערכת תסדר הכל לבד לפי חברות, מכשירים ונושאים.</div>
            <div className="row wrap-row">
              <button className="btn primary" onClick={() => open({ t: 'import' })}>💬 ייבוא מוואטסאפ</button>
              <button className="btn" onClick={() => open({ t: 'edit' })}>➕ הוספת מידע</button>
              {isAdmin && <button className="btn" onClick={() => open({ t: 'team' })}>👥 הזמנת עובדים</button>}
            </div>
          </div>
        )}
        <AskBanner ctx={ctx} />
        <BoardBanner ctx={ctx} />
        {pinned.length > 0 && <><div className="h2">📌 נעוצים</div>{pinned.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} />)}</>}
        {recentOpened.length > 0 && <><div className="h2">🕘 פתחתי לאחרונה</div>{recentOpened.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} />)}</>}
        <div className="h2">🏢 חברות</div>
        <div className="chips">{topCompanies.map((t) => <button key={t.id} className="chip k-company" onClick={() => pick(t)}>{t.name} <span className="n">{counts[t.id] || ''}</span></button>)}
          <button className="chip add" onClick={() => setTab('company')}>הכל ›</button></div>
        <div className="h2">🗂️ נושאים</div>
        <div className="chips">{topTopics.map((t) => <button key={t.id} className="chip k-topic" onClick={() => pick(t)}>{t.emoji} {t.name} <span className="n">{counts[t.id] || ''}</span></button>)}
          <button className="chip add" onClick={() => setTab('topic')}>הכל ›</button></div>
        {latest.length > 0 && <><div className="h2">✨ עודכן לאחרונה</div>{latest.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} showWho />)}</>}
      </>
    );
  }

  const words = queryWords(q);
  const waiting = ctx.asks.filter((a) => needsAnswer(a, ctx)).length;
  return (
    <div className="wrap">
      <div className="top">
        <div className="row">
          {shop.logo_url ? <img className="shop-logo" src={shop.logo_url} alt="" onClick={clearAll} /> : null}
          <h1 className="title grow" onClick={clearAll}>{shop.logo_url ? '' : '🗂️ '}{shop.name}</h1>
          <button className="icon-btn" aria-label="שאל" onClick={() => open({ t: 'ask' })}>✨</button>
          <button className="icon-btn" aria-label="הודעות" onClick={() => open({ t: 'board' })}>📣{ctx.unread > 0 && <span className="dot">{ctx.unread}</span>}</button>
          {isAdmin && shop.pending > 0 && <button className="icon-btn" aria-label="עובדים" onClick={() => open({ t: 'team' })}>👥<span className="dot">{shop.pending}</span></button>}
          <button className="icon-btn" aria-label="עוד" onClick={() => open({ t: 'more' })}>☰</button>
        </div>
        <div className="search" style={{ marginTop: 10 }}>
          <span>🔎</span>
          <input ref={inputRef} className="input" type="search" enterKeyHint="search" placeholder="חיפוש: קוד, IMEI, חברה, נקודת שירות…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q ? <button onClick={() => { setQ(''); inputRef.current?.focus(); }} aria-label="נקה">✕</button>
            : <button onClick={() => open({ t: 'scan', onPick: (n) => setQ(n) })} aria-label="סריקת IMEI" style={{ fontSize: 19 }}>📷</button>}
        </div>
        {filtering ? (
          <div className="chips">
            {type && <button className="chip on" onClick={() => setType('')}>{typeOf(type).e} {typeOf(type).label} ✕</button>}
            {sel.map((id) => tagsById[id] && <button key={id} className={'chip on k-' + tagsById[id].kind} onClick={() => pick(tagsById[id])}>{tagsById[id].name} ✕</button>)}
            {tagHits.map((t) => <button key={t.id} className={'chip k-' + t.kind} onClick={() => pick(t)}>+ {t.name}</button>)}
            {photosOnly && <button className="chip on" onClick={() => setPhotosOnly(false)}>🖼️ עם תמונות ✕</button>}
            {(sel.length > 0 || type || photosOnly) && <button className="chip add" onClick={clearAll}>נקה הכל</button>}
          </div>
        ) : (
          <div className="tabs">{TABS.map((t) => <button key={t.k} className={'tab' + (tab === t.k ? ' on' : '')} onClick={() => setTab(t.k)}>{t.label}</button>)}</div>
        )}
      </div>

      {filtering ? (
        <>
          {imei && (
            <div className={'notice ' + (imei.ok ? 'ok-box' : 'bad-box')}>
              <div className="row">
                <div className="grow">
                  {imei.fixed ? <>14 ספרות — ה-IMEI המלא (עם ספרת ביקורת):</> : imei.ok ? '✓ IMEI תקין' : '✗ IMEI לא תקין (ספרת הביקורת לא מתאימה)'}
                  <div className="mono" style={{ fontSize: 19, marginTop: 2 }}>{imei.imei}</div>
                </div>
                <button className="btn sm" onClick={() => copyText(imei.imei).then(() => ctx.toast('הועתק'))}>העתק</button>
              </div>
              <div className="row wrap-row" style={{ marginTop: 8 }}>
                <a className="btn sm" href={'https://www.imei.info/?imei=' + imei.imei} target="_blank" rel="noreferrer">בדיקת דגם ↗</a>
                <button className="btn sm" onClick={() => open({ t: 'edit', draft: { type: 'imei', fields: { imei: imei.imei } } })}>➕ שמירה במאגר</button>
              </div>
            </div>
          )}
          {related.length > 0 && (
            <div className="chips" style={{ paddingTop: 0 }}>
              <span className="muted small" style={{ alignSelf: 'center', flex: 'none' }}>צמצום:</span>
              {related.map(({ t, n }) => <button key={t.id} className={'chip k-' + t.kind} onClick={() => pick(t)}>{t.name} <span className="n">{n}</span></button>)}
            </div>
          )}
          {results.length > 0 && (
            <div className="row" style={{ margin: '8px 2px' }}>
              <div className="muted small grow">{results.length} תוצאות</div>
              <button className={'view-btn' + (view === 'list' ? ' on' : '')} onClick={() => setViewKeep('list')}>☰ רשימה</button>
              <button className={'view-btn' + (view === 'gallery' ? ' on' : '')} onClick={() => setViewKeep('gallery')}>🖼️ תמונות</button>
            </div>
          )}
          {view === 'gallery' ? <Gallery items={results.slice(0, limit)} ctx={ctx} />
            : results.slice(0, limit).map((it) => <ItemRow key={it.id} it={it} ctx={ctx} words={words} />)}
          {results.length > limit && <button className="btn block" onClick={() => setLimit((l) => l + 100)}>עוד {results.length - limit}…</button>}
          {!results.length && (
            <div className="empty">
              <div className="e">🤷</div>
              <div>לא נמצא{q ? ` "${q}"` : ''}</div>
              <div className="row wrap-row" style={{ justifyContent: 'center', marginTop: 14 }}>
                {q && <button className="btn soft" onClick={() => open({ t: 'ask', q })}>✨ לשאול את המאגר</button>}
                <button className="btn" onClick={() => open({ t: 'edit', draft: { title: q, tag_ids: sel, type: type || undefined } })}>➕ להוסיף את זה</button>
              </div>
            </div>
          )}
        </>
      ) : browse()}

      <div className="bottom-bar">
        <button className="fab alt" onClick={() => open({ t: 'asks' })}>💰 מחיר{waiting > 0 && <span className="dot">{waiting}</span>}</button>
        <button className="fab" onClick={() => open({ t: 'edit', draft: { tag_ids: sel, type: type || undefined } })}>➕ הוספת מידע</button>
      </div>
    </div>
  );
}

// הודעה קופצת: יש הודעות חדשות מהעובדים
function BoardBanner({ ctx }) {
  const fresh = ctx.posts.filter((p) => isUnread(p, ctx)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const open = ctx.posts.filter((p) => !p.deleted_at && p.status === 'open');
  if (fresh.length) {
    const p = fresh[0];
    return (
      <button className="card board-banner" onClick={() => ctx.open({ t: 'board' })}>
        <span className="e">📣</span>
        <span className="grow">
          <b>{fresh.length === 1 ? 'הודעה חדשה' : `${fresh.length} הודעות חדשות`}</b>
          <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kindOf(p.kind).e} {p.author_name}: {p.title || p.body}</div>
        </span>
        <span className="btn sm primary">פתיחה</span>
      </button>
    );
  }
  if (!open.length) return null;
  return (
    <button className="card it" style={{ marginTop: 10, alignItems: 'center' }} onClick={() => ctx.open({ t: 'board' })}>
      <div className="ic">📣</div>
      <div className="grow"><div className="t">{open.length} הודעות ומשימות פתוחות</div>
        <div className="s">{open.slice(0, 2).map((p) => kindOf(p.kind).e + ' ' + (p.title || p.body)).join(' · ')}</div></div>
    </button>
  );
}

// בירור מחיר שמחכה לתשובה
function AskBanner({ ctx }) {
  const list = ctx.asks.filter((a) => needsAnswer(a, ctx)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!list.length) return null;
  const a = list[0];
  return (
    <button className="card board-banner" style={{ borderColor: '#d97706' }} onClick={() => ctx.open({ t: 'asks' })}>
      {a.photos?.[0] ? <img src={a.photos[0]} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} /> : <span className="e">💰</span>}
      <span className="grow">
        <b>{list.length === 1 ? 'מישהו שואל מחיר' : `${list.length} בירורי מחיר מחכים`}</b>
        <div className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.asked_by_name}: {a.product || 'מה המחיר?'}</div>
      </span>
      <span className="btn sm" style={{ background: '#d97706', color: '#fff', borderColor: '#d97706' }}>לענות</span>
    </button>
  );
}
