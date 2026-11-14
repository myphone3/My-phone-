'use client';
import { useMemo, useState } from 'react';
import { emojiFor, metaLine } from './ui';

export default function Library({ data, recipes, cast, go, openSheet }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set(recipes.map((r) => r.category).filter(Boolean))], [recipes]);
  const hasFav = recipes.some((r) => r.favorite);

  const list = useMemo(() => {
    const t = q.trim();
    return recipes.filter((r) => {
      if (cat === '★' && !r.favorite) return false;
      if (cat && cat !== '★' && r.category !== cat) return false;
      if (!t) return true;
      const hay = [r.title, r.description, r.category, ...(r.tags || []), ...(r.ingredients || []).flatMap((g) => g.items || [])].join(' ');
      return hay.includes(t);
    });
  }, [recipes, q, cat]);

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
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מתכון או מצרך..." />
            </div>
            {(cats.length > 1 || hasFav) && (
              <div className="chips" style={{ marginTop: 10 }}>
                <button className={'chip' + (!cat ? ' on' : '')} onClick={() => setCat('')}>הכל</button>
                {hasFav && <button className={'chip' + (cat === '★' ? ' on' : '')} onClick={() => setCat('★')}>❤️ מועדפים</button>}
                {cats.map((c) => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
              </div>
            )}
          </>
        )}
      </div>

      {!data && <div className="busy"><div className="spinner" /></div>}

      {data && !recipes.length && (
        <div className="empty">
          <div className="e">📖</div>
          <h3>עוד אין מתכונים</h3>
          <p className="muted">צלמו מתכון, בחרו תמונה מהגלריה או קובץ PDF — והמתכון יסודר אוטומטית לפי מצרכים ושלבים.</p>
          <button className="btn primary big" style={{ marginTop: 10 }} onClick={() => openSheet('add')}>＋ הוספת מתכון ראשון</button>
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
              <div className="m">{metaLine(r) || r.category || ' '}</div>
            </div>
          </button>
        ))}
      </div>

      {recipes.length > 0 && <button className="fab" onClick={() => openSheet('add')}>＋ מתכון חדש</button>}
    </div>
  );
}
