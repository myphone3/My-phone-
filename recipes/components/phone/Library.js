'use client';
import { useMemo, useState } from 'react';
import { dayKey } from '@/lib/recipe';
import { emojiFor, metaLine } from './ui';

const SORTS = [
  ['new', 'חדשים'],
  ['abc', 'א-ב'],
  ['cooked', 'הכי מבושלים'],
  ['rating', 'דירוג'],
  ['quick', 'הכי מהירים'],
];

export default function Library({ data, recipes, cast, go, openSheet, say }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('new');
  const [pick, setPick] = useState(null);
  const cats = useMemo(() => [...new Set(recipes.map((r) => r.category).filter(Boolean))], [recipes]);
  const hasFav = recipes.some((r) => r.favorite);
  const today = ((data?.kitchen?.plan || {})[dayKey(new Date())] || []).map((id) => recipes.find((r) => r.id === id)).filter(Boolean);

  const list = useMemo(() => {
    const t = q.trim();
    const out = recipes.filter((r) => {
      if (cat === '★' && !r.favorite) return false;
      if (cat && cat !== '★' && r.category !== cat) return false;
      if (!t) return true;
      const hay = [r.title, r.description, r.category, r.notes, ...(r.tags || []), ...(r.ingredients || []).flatMap((g) => g.items || [])].join(' ');
      return t.split(/\s+/).every((w) => hay.includes(w));
    });
    const time = (r) => (Number(r.prep_minutes) || 0) + (Number(r.cook_minutes) || 0) || 9999;
    const by = {
      new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
      abc: (a, b) => a.title.localeCompare(b.title, 'he'),
      cooked: (a, b) => (b.cooked_count || 0) - (a.cooked_count || 0),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.favorite - a.favorite),
      quick: (a, b) => time(a) - time(b),
    }[sort];
    return [...out].sort(by);
  }, [recipes, q, cat, sort]);

  const surprise = () => {
    if (!recipes.length) return;
    // מעדיפים מה שמזמן לא בושל
    const weighted = recipes.flatMap((r) => {
      const days = r.last_cooked_at ? (Date.now() - new Date(r.last_cooked_at)) / 864e5 : 60;
      return Array(Math.max(1, Math.min(6, Math.round(days / 10)))).fill(r);
    });
    let r;
    do { r = weighted[Math.floor(Math.random() * weighted.length)]; } while (recipes.length > 1 && pick && r.id === pick.id);
    setPick(r);
  };

  const music = cast.state.music;
  return (
    <div className="wrap">
      <div className="top">
        <div className="row">
          <h1 className="h1 grow">{data?.kitchen?.name || 'המתכונים שלי'}</h1>
          <button className={'tv-chip' + (cast.tvOnline ? ' on' : '')} onClick={() => openSheet('tv')}>
            <span className="dot" /> {cast.tvOnline ? 'טלוויזיה' : 'חיבור לטלוויזיה'}
          </button>
          <button className="icon-btn" aria-label="מוזיקה" onClick={() => openSheet('music')} style={music?.playing ? { color: 'var(--accent)' } : undefined}>🎵</button>
          <button className="icon-btn" aria-label="הגדרות" onClick={() => openSheet('settings')}>⚙️</button>
        </div>
        {recipes.length > 0 && (
          <>
            <div className="search">
              <span>🔍</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מתכון, מצרך או הערה..." />
            </div>
            <div className="chips" style={{ marginTop: 10 }}>
              <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat('')}>הכל ({recipes.length})</button>
              {hasFav && <button className={'chip' + (cat === '★' ? ' on' : '')} onClick={() => setCat('★')}>❤️ מועדפים</button>}
              {cats.map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{emojiFor({ category: c })} {c}</button>)}
            </div>
          </>
        )}
      </div>

      {!data && <div className="busy"><div className="spinner" /></div>}

      {data && !recipes.length && (
        <div className="empty">
          <div className="e">📖</div>
          <h3>עוד אין מתכונים</h3>
          <p className="muted">צלמו מתכון, בחרו תמונה מהגלריה, קובץ PDF או קישור לאתר מתכונים — והמתכון יסודר אוטומטית לפי מצרכים ושלבים.</p>
          <button className="btn primary big" style={{ marginTop: 10 }} onClick={() => openSheet('add')}>＋ הוספת מתכון ראשון</button>
        </div>
      )}

      {data && recipes.length > 0 && !q && !cat && (
        <>
          <div className="toolbar" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <button onClick={() => go({ name: 'plan' })}><span>📅</span>תפריט השבוע</button>
            <button onClick={surprise}><span>🎲</span>מה לבשל היום?</button>
            <button onClick={() => openSheet('music')}><span>🎶</span>מוזיקה לבישול</button>
          </div>
          {pick && (
            <button className="card" style={{ display: 'flex', marginTop: 10, alignItems: 'stretch' }} onClick={() => go({ name: 'recipe', id: pick.id })}>
              <div className="ph" style={{ width: 120, aspectRatio: 'auto', flex: 'none' }}>{pick.image_url ? <img src={pick.image_url} alt="" /> : emojiFor(pick)}</div>
              <div className="bd" style={{ flex: 1 }}>
                <div className="small" style={{ color: 'var(--accent)', fontWeight: 800 }}>🎲 ההצעה שלנו להיום</div>
                <div className="t">{pick.title}</div>
                <div className="m">{metaLine(pick)}</div>
                <span className="small muted" onClick={(e) => { e.stopPropagation(); surprise(); }} style={{ textDecoration: 'underline' }}>הצעה אחרת</span>
              </div>
            </button>
          )}
          {today.length > 0 && (
            <>
              <h2 className="h2" style={{ fontSize: 16, margin: '16px 0 8px' }}>📅 בתפריט היום</h2>
              <div className="chips">
                {today.map((r) => <button key={r.id} className="chip" style={{ height: 42 }} onClick={() => go({ name: 'recipe', id: r.id })}>{emojiFor(r)} {r.title}</button>)}
              </div>
            </>
          )}
        </>
      )}

      {data && recipes.length > 1 && (
        <div className="row" style={{ marginTop: 14 }}>
          <span className="grow small muted">{list.length} מתכונים</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 13, height: 36 }}>
            {SORTS.map(([k, l]) => <option key={k} value={k}>מיון: {l}</option>)}
          </select>
        </div>
      )}

      {data && recipes.length > 0 && !list.length && <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>לא מצאנו מתכון כזה</p>}

      <div className="grid">
        {list.map((r) => (
          <button key={r.id} className="card" onClick={() => go({ name: 'recipe', id: r.id })}>
            <div className="ph">{r.image_url ? <img src={r.image_url} alt="" loading="lazy" /> : emojiFor(r)}</div>
            {r.favorite && <span className="fav">❤️</span>}
            {cast.tvOnline && cast.state.recipeId === r.id && <span className="live">📺 בטלוויזיה</span>}
            <div className="bd">
              <div className="t">{r.title}</div>
              <div className="m">{metaLine(r) || r.category || ' '}{r.rating ? ` · ${'⭐'.repeat(r.rating)}` : ''}</div>
            </div>
          </button>
        ))}
      </div>

      {recipes.length > 0 && <button className="fab" onClick={() => openSheet('add')}>＋ מתכון חדש</button>}
    </div>
  );
}
