'use client';
// חלונות נוספים למתכון: רשימת קניות, ערכים תזונתיים, שיתוף עם חברים, צילום מנה מוכנה
import { useRef, useState } from 'react';
import { groups, scaleText, shareText, recipeText } from '@/lib/recipe';
import { fetchNutrition, patchRecipe, shareRecipe, uploadImage } from '@/lib/api';
import { compressImage } from '@/lib/importer';
import { Sheet, Loader } from './ui';

// ---- רשימת קניות מתוך המתכון ----
export function ShoppingSheet({ recipe, cast, onClose, say }) {
  const active = cast.state.recipeId === recipe.id;
  const base = Number(recipe.servings) || null;
  const [servings, setServings] = useState((active && cast.state.servings) || base);
  const factor = base && servings ? servings / base : 1;
  const ing = groups(recipe.ingredients);
  const [have, setHave] = useState(() => ({ ...((active && cast.state.checked) || {}) }));
  const need = ing.flatMap((g, gi) => g.items.map((item, i) => ({ key: `${gi}-${i}`, text: scaleText(item, factor) })));
  const list = need.filter((x) => !have[x.key]);
  const text = `🛒 *קניות ל${recipe.title}*${servings ? ` (${servings} מנות)` : ''}\n` + list.map((x) => '• ' + x.text).join('\n');

  const copy = async () => { try { await navigator.clipboard.writeText(text); say('הרשימה הועתקה ✓'); } catch { say('לא הצלחנו להעתיק'); } };

  return (
    <Sheet onClose={onClose}>
      <h3>🛒 רשימת קניות</h3>
      <p className="muted small" style={{ marginTop: -6 }}>סמנו מה כבר יש לכם בבית — כל השאר ייכנס לרשימה</p>
      {base && (
        <div className="serv" style={{ marginBottom: 10 }}>
          <span className="grow small muted">כמות מנות</span>
          <button onClick={() => setServings(Math.max(1, (servings || base) - 1))}>−</button>
          <b>{servings}</b>
          <button onClick={() => setServings((servings || base) + 1)}>+</button>
        </div>
      )}
      <div className="box">
        {ing.map((g, gi) => (
          <div key={gi}>
            {g.title && <div className="group-t">{g.title}</div>}
            {g.items.map((item, i) => {
              const key = `${gi}-${i}`;
              return (
                <button key={key} className={'ing' + (have[key] ? ' done' : '')} onClick={() => setHave((h) => ({ ...h, [key]: !h[key] }))}>
                  <span className="ck">{have[key] ? '✓' : ''}</span>
                  <span>{scaleText(item, factor)}</span>
                  {have[key] && <small className="muted" style={{ marginInlineStart: 'auto', textDecoration: 'none' }}>יש בבית</small>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="small" style={{ fontWeight: 700, margin: '12px 2px' }}>{list.length ? `${list.length} מצרכים לקנות` : 'יש לכם הכל! 🎉'}</p>
      <div className="row">
        <button className="btn primary grow" disabled={!list.length} onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')}>וואטסאפ</button>
        <button className="btn grow" disabled={!list.length} onClick={() => shareText(text, 'רשימת קניות')}>📤 שליחה…</button>
        <button className="btn" disabled={!list.length} onClick={copy}>העתקה</button>
      </div>
    </Sheet>
  );
}

// ---- ערכים תזונתיים (רק כשנכנסים לזה) ----
const ROWS = [['kcal', 'קלוריות', ''], ['protein_g', 'חלבון', 'גרם'], ['carbs_g', 'פחמימות', 'גרם'], ['sugar_g', 'מתוכן סוכרים', 'גרם'], ['fat_g', 'שומן', 'גרם'], ['sat_fat_g', 'מתוכו רווי', 'גרם'], ['fiber_g', 'סיבים תזונתיים', 'גרם'], ['sodium_mg', 'נתרן', 'מ"ג']];

export function NutritionSheet({ recipe, kitchenId, changed, onClose }) {
  const [data, setData] = useState(recipe.nutrition || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const calc = async () => {
    setBusy(true); setErr('');
    try {
      const nut = await fetchNutrition(recipe);
      setData(nut);
      try { await patchRecipe(kitchenId, recipe.id, { nutrition: nut }); await changed(); } catch {}
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const p = data?.per_serving || {};
  return (
    <Sheet onClose={onClose}>
      <h3>🥗 ערכים תזונתיים</h3>
      {!data && !busy && (
        <>
          <p className="muted">נחשב הערכה של קלוריות, חלבון, פחמימות ושומן למנה — לפי המצרכים במתכון.</p>
          <button className="btn primary big block" onClick={calc}>חישוב</button>
        </>
      )}
      {busy && <div className="busy"><Loader /><b>מחשבים...</b></div>}
      {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
      {data && !busy && (
        <>
          <div className="nut-hero"><b>{p.kcal ?? '—'}</b><span>קלוריות למנה{data.servings ? ` (מתוך ${data.servings} מנות)` : ''}</span></div>
          <div className="box" style={{ padding: '4px 14px' }}>
            {ROWS.slice(1).map(([k, l, u]) => p[k] !== null && p[k] !== undefined && (
              <div key={k} className="nut-row"><span>{l}</span><b>{p[k]} {u}</b></div>
            ))}
          </div>
          <div className="pills" style={{ marginTop: 10 }}>
            {data.kashrut && <span className="pill">{data.kashrut}</span>}
            {(data.labels || []).map((l) => <span key={l} className="pill" style={{ background: 'var(--herb-soft)' }}>{l}</span>)}
          </div>
          {data.allergens?.length > 0 && <p className="small"><b>⚠️ אלרגנים:</b> {data.allergens.join(', ')}</p>}
          {data.note && <p className="muted small">{data.note}</p>}
          <p className="muted small">הערכה בלבד, לפי ערכים ממוצעים. {data.total_kcal ? `סה״כ במתכון: כ-${data.total_kcal} קלוריות.` : ''}</p>
          <button className="btn block" onClick={calc}>חישוב מחדש</button>
        </>
      )}
    </Sheet>
  );
}

// ---- שיתוף עם חברים: קישור שנפתח יפה גם בלי האפליקציה ----
export function ShareSheet({ recipe, kitchenId, onClose, say }) {
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const make = async () => {
    if (link) return link;
    setBusy(true);
    try {
      const code = await shareRecipe(kitchenId, recipe.id);
      const url = `${location.origin}/r/${code}`;
      setLink(url);
      setBusy(false);
      return url;
    } catch { say('לא הצלחנו ליצור קישור, נסו שוב'); setBusy(false); return null; }
  };
  const msg = (url) => `🍽️ ${recipe.title}\nשלחתי לך את המתכון — אפשר לראות אותו ולשמור אותו אצלך:\n${url}`;
  const wa = async () => { const url = await make(); if (url) window.open('https://wa.me/?text=' + encodeURIComponent(msg(url)), '_blank'); };
  const any = async () => { const url = await make(); if (url) shareText(msg(url), recipe.title); };
  const copy = async () => { const url = await make(); if (url) { try { await navigator.clipboard.writeText(url); say('הקישור הועתק ✓'); } catch {} } };
  return (
    <Sheet onClose={onClose}>
      <h3>📤 שיתוף עם חברים</h3>
      <p className="muted small" style={{ marginTop: -6 }}>החברים יקבלו קישור למתכון — מסודר ויפה, וגם בלי האפליקציה. בלחיצה הם יכולים לשמור אותו בספר המתכונים שלהם. ההערות והדירוג שלכם לא נשלחים.</p>
      <button className="option" onClick={wa} disabled={busy}><span className="oi">💬</span><span><b>וואטסאפ</b><small>שליחת קישור למתכון</small></span></button>
      <button className="option" onClick={any} disabled={busy}><span className="oi">📤</span><span><b>שליחה באפליקציה אחרת</b><small>מייל, הודעה, טלגרם...</small></span></button>
      <button className="option" onClick={copy} disabled={busy}><span className="oi">🔗</span><span><b>העתקת קישור</b><small>{link || 'ליצור קישור ולהעתיק'}</small></span></button>
      <button className="option" onClick={() => shareText(recipeText(recipe), recipe.title)}><span className="oi">📝</span><span><b>שליחת המתכון כטקסט</b><small>כל המצרכים והשלבים בהודעה אחת</small></span></button>
    </Sheet>
  );
}

// ---- צילום מנה מוכנה ----
export function useDishPhoto({ recipe, kitchenId, changed, say }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = () => input.current?.click();
  const onFile = async (f) => {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadImage(kitchenId, await compressImage(f, 1600));
      await patchRecipe(kitchenId, recipe.id, { add_photo: url, ...(recipe.image_url ? {} : { image_url: url }) });
      await changed();
      say(recipe.image_url ? '📸 התמונה נשמרה בגלריה' : '📸 התמונה נשמרה כתמונה הראשית');
    } catch { say('התמונה לא נשמרה, נסו שוב'); }
    setBusy(false);
  };
  const el = <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />;
  return { pick, busy, el };
}
