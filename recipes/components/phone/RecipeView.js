'use client';
import { useState } from 'react';
import { groups, scaleText, fmtMinutes, flatSteps } from '@/lib/recipe';
import { useRecipeSession } from '@/lib/session';
import { setFavorite, deleteRecipe } from '@/lib/api';
import { emojiFor } from './ui';

export default function RecipeView({ recipe, cast, follow, go, back, kitchenId, changed, say }) {
  const { s, set, active, show } = useRecipeSession(cast, recipe, follow);
  const [viewer, setViewer] = useState(null);
  const base = Number(recipe.servings) || null;
  const servings = s.servings ?? base;
  const factor = base && servings ? servings / base : 1;
  const ing = groups(recipe.ingredients);
  const steps = groups(recipe.steps);
  const tips = (recipe.tips || []).filter(Boolean);
  const checked = s.checked || {};
  const onTv = cast.tvOnline && active;
  const curStep = onTv && (cast.state.screen === 'cook') ? s.step : -1;
  let n = 0;

  const toggle = (key) => set((st) => ({ checked: { ...(st.checked || {}), [key]: !(st.checked || {})[key] } }));
  const fav = async () => {
    try { await setFavorite(kitchenId, recipe.id, !recipe.favorite); await changed(); } catch { say('לא נשמר, נסו שוב'); }
  };
  const remove = async () => {
    if (!confirm(`למחוק את "${recipe.title}"?`)) return;
    try { await deleteRecipe(kitchenId, recipe.id); await changed(); if (active) cast.update({ screen: 'home', recipeId: null }); back(); say('המתכון נמחק'); } catch { say('לא נמחק, נסו שוב'); }
  };
  const startCook = () => {
    if (active || follow) cast.update({ screen: 'cook', recipeId: recipe.id, step: s.step || 0, servings: s.servings ?? null, checked: s.checked || {} });
    go({ name: 'cook', id: recipe.id });
  };

  return (
    <div className="wrap">
      <div className="hero">
        {recipe.image_url ? <img src={recipe.image_url} alt="" /> : emojiFor(recipe)}
        <div className="bar">
          <button className="icon-btn" onClick={back} aria-label="חזרה">→</button>
          <div className="row">
            <button className="icon-btn" onClick={fav} aria-label="מועדף">{recipe.favorite ? '❤️' : '🤍'}</button>
            <button className="icon-btn" onClick={() => go({ name: 'edit', editId: recipe.id })} aria-label="עריכה">✏️</button>
          </div>
        </div>
      </div>

      <h1 className="title-lg">{recipe.title}</h1>
      {recipe.description && <p className="muted" style={{ margin: '0 0 6px' }}>{recipe.description}</p>}
      <div className="pills">
        {recipe.prep_minutes ? <span className="pill">🔪 הכנה {fmtMinutes(recipe.prep_minutes)}</span> : null}
        {recipe.cook_minutes ? <span className="pill">🔥 בישול {fmtMinutes(recipe.cook_minutes)}</span> : null}
        {recipe.category && <span className="pill">{recipe.category}</span>}
        {(recipe.tags || []).map((t) => <span key={t} className="pill">{t}</span>)}
      </div>

      <div className="actions">
        <button className={'btn big ' + (onTv ? 'herb' : 'soft')} onClick={() => show('recipe')}>
          📺 {onTv ? 'מוצג בטלוויזיה' : 'הצגה בטלוויזיה'}
        </button>
        <button className="btn primary big" onClick={startCook}>👩‍🍳 מתחילים לבשל</button>
      </div>
      {!cast.tvOnline && <p className="muted small" style={{ textAlign: 'center', margin: '4px 0 0' }}>הטלוויזיה לא מחוברת כרגע — אפשר לבשל גם מהטלפון</p>}

      <div className="row" style={{ marginTop: 22, alignItems: 'flex-end' }}>
        <h2 className="h2 grow" style={{ margin: 0 }}>🧺 מצרכים</h2>
        {base && (
          <div className="serv">
            <button onClick={() => set({ servings: Math.max(1, (servings || base) - 1) })}>−</button>
            <b>{servings}</b>
            <span className="small muted">מנות</span>
            <button onClick={() => set({ servings: (servings || base) + 1 })}>+</button>
          </div>
        )}
      </div>
      {factor !== 1 && <p className="small" style={{ color: 'var(--accent)', margin: '8px 2px 0', fontWeight: 600 }}>הכמויות מחושבות ל-{servings} מנות (במקור {base})</p>}
      <div className="box" style={{ marginTop: 10 }}>
        {ing.length === 0 && <p className="muted">אין מצרכים</p>}
        {ing.map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="group-t">{g.title}</div>}
            {g.items.map((item, i) => {
              const key = `${gi}-${i}`;
              return (
                <button key={key} className={'ing' + (checked[key] ? ' done' : '')} onClick={() => toggle(key)}>
                  <span className="ck">{checked[key] ? '✓' : ''}</span>
                  <span>{scaleText(item, factor)}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <h2 className="h2">📝 אופן ההכנה</h2>
      <div className="box">
        {steps.map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="group-t">{g.title}</div>}
            {g.items.map((text, i) => {
              const idx = n++;
              return (
                <button key={i} className={'step' + (idx === curStep ? ' cur' : idx < curStep ? ' past' : '')}
                  onClick={() => { set({ step: idx }); if (active || follow) cast.update({ screen: 'cook', recipeId: recipe.id, step: idx }); go({ name: 'cook', id: recipe.id }); }}>
                  <span className="n">{idx + 1}</span>
                  <span>{text}</span>
                </button>
              );
            })}
          </div>
        ))}
        {!flatSteps(recipe).length && <p className="muted">אין שלבים</p>}
      </div>

      {tips.length > 0 && (
        <>
          <h2 className="h2">💡 טיפים</h2>
          {tips.map((t, i) => <div key={i} className="tip">{t}</div>)}
        </>
      )}

      {recipe.source_images?.length > 0 && (
        <>
          <h2 className="h2">📄 המתכון המקורי</h2>
          <div className="thumbs">
            {recipe.source_images.map((u, i) => (
              <button key={u} onClick={() => setViewer(i)}><img src={u} alt={`עמוד ${i + 1}`} loading="lazy" /></button>
            ))}
          </div>
        </>
      )}

      <button className="btn danger block" style={{ marginTop: 30 }} onClick={remove}>🗑️ מחיקת המתכון</button>

      {viewer !== null && (
        <div className="viewer">
          <div className="bar">
            <button className="btn" onClick={() => setViewer(null)}>סגירה</button>
            <span>{viewer + 1} / {recipe.source_images.length}</span>
            <button className="btn soft" onClick={() => show('original', { page: viewer })}>📺 בטלוויזיה</button>
          </div>
          <div className="vi"><img src={recipe.source_images[viewer]} alt="" /></div>
          {recipe.source_images.length > 1 && (
            <div className="bar">
              <button className="btn" disabled={viewer >= recipe.source_images.length - 1} onClick={() => { setViewer(viewer + 1); if (cast.state.screen === 'original' && active) cast.update({ page: viewer + 1 }); }}>הבא ←</button>
              <button className="btn" disabled={viewer <= 0} onClick={() => { setViewer(viewer - 1); if (cast.state.screen === 'original' && active) cast.update({ page: viewer - 1 }); }}>→ הקודם</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
