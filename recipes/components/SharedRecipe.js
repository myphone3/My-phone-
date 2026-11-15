'use client';
// דף מתכון ששותף: נראה יפה גם למי שאין לו את האפליקציה, ואפשר לשמור אותו בספר המתכונים
import { useState } from 'react';
import { groups, scaleText, fmtMinutes } from '@/lib/recipe';
import { createKitchen, saveRecipe } from '@/lib/api';
import { getKitchenId, setKitchenId } from '@/lib/local';
import { emojiFor } from '@/components/phone/ui';

export default function SharedRecipe({ recipe }) {
  const [servings, setServings] = useState(Number(recipe?.servings) || null);
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!recipe) {
    return <div className="wrap empty"><div className="e">🤔</div><h3>המתכון לא נמצא</h3><p className="muted">אולי הקישור לא שלם. בקשו מהחבר לשלוח שוב.</p><a className="btn primary" href="/">למתכונים שלי</a></div>;
  }
  const base = Number(recipe.servings) || null;
  const factor = base && servings ? servings / base : 1;
  let n = 0;

  const save = async () => {
    setBusy(true);
    try {
      let k = getKitchenId();
      if (!k) { k = await createKitchen('המתכונים שלי'); setKitchenId(k); }
      const { nutrition, ...r } = recipe;
      await saveRecipe(k, { ...r, id: null });
      setSaved(true);
    } catch { alert('לא הצלחנו לשמור, נסו שוב'); }
    setBusy(false);
  };

  return (
    <div className="wrap">
      <div className="hero">{recipe.image_url ? <img src={recipe.image_url} alt="" /> : emojiFor(recipe)}</div>
      <p className="small" style={{ color: 'var(--accent)', fontWeight: 800, margin: '14px 0 0' }}>🍳 מתכון ששותף איתך</p>
      <h1 className="title-lg" style={{ marginTop: 4 }}>{recipe.title}</h1>
      {recipe.description && <p className="muted" style={{ margin: '0 0 6px' }}>{recipe.description}</p>}
      <div className="pills">
        {recipe.prep_minutes ? <span className="pill">🔪 הכנה {fmtMinutes(recipe.prep_minutes)}</span> : null}
        {recipe.cook_minutes ? <span className="pill">🔥 בישול {fmtMinutes(recipe.cook_minutes)}</span> : null}
        {recipe.category && <span className="pill">{recipe.category}</span>}
      </div>

      {saved ? (
        <div className="tip" style={{ marginTop: 14 }}>✓ נשמר בספר המתכונים שלך! <a href="/" style={{ fontWeight: 800 }}>לפתיחת המתכונים ←</a></div>
      ) : (
        <button className="btn primary big block" style={{ marginTop: 14 }} disabled={busy} onClick={save}>{busy ? 'שומרים...' : '＋ שמירה בספר המתכונים שלי'}</button>
      )}

      <div className="row" style={{ marginTop: 22, alignItems: 'flex-end' }}>
        <h2 className="h2 grow" style={{ margin: 0 }}>🧺 מצרכים</h2>
        {base && (
          <div className="serv">
            <button onClick={() => setServings(Math.max(1, servings - 1))}>−</button>
            <b>{servings}</b><span className="small muted">מנות</span>
            <button onClick={() => setServings(servings + 1)}>+</button>
          </div>
        )}
      </div>
      <div className="box" style={{ marginTop: 10 }}>
        {groups(recipe.ingredients).map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="group-t">{g.title}</div>}
            {g.items.map((item, i) => {
              const key = `${gi}-${i}`;
              return <button key={key} className={'ing' + (checked[key] ? ' done' : '')} onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}><span className="ck">{checked[key] ? '✓' : ''}</span><span>{scaleText(item, factor)}</span></button>;
            })}
          </div>
        ))}
      </div>
      <h2 className="h2">📝 אופן ההכנה</h2>
      <div className="box">
        {groups(recipe.steps).map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="group-t">{g.title}</div>}
            {g.items.map((t, i) => <div key={i} className="step"><span className="n">{++n}</span><span>{t}</span></div>)}
          </div>
        ))}
      </div>
      {(recipe.tips || []).filter(Boolean).length > 0 && (
        <>
          <h2 className="h2">💡 טיפים</h2>
          {recipe.tips.filter(Boolean).map((t, i) => <div key={i} className="tip">{t}</div>)}
        </>
      )}
      <p className="muted small" style={{ textAlign: 'center', marginTop: 30 }}>נשלח מ״מתכונים בגדול״ — המתכונים שלכם מסודרים, ובגדול על הטלוויזיה</p>
    </div>
  );
}
