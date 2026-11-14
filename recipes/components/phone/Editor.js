'use client';
import { useRef, useState } from 'react';
import { CATEGORIES, emptyRecipe } from '@/lib/recipe';
import { saveRecipe, uploadImage } from '@/lib/api';
import { compressImage } from '@/lib/importer';

const toText = (items) => (items || []).join('\n');
const toItems = (text) => String(text || '').split('\n').map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim()).filter(Boolean);

function Groups({ label, hint, value, onChange, placeholder }) {
  const set = (i, patch) => onChange(value.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <>
      <h2 className="h2">{label}</h2>
      <p className="muted small" style={{ margin: '-4px 2px 8px' }}>{hint}</p>
      {value.map((g, i) => (
        <div key={i} className="box" style={{ padding: 12, marginBottom: 10 }}>
          {(value.length > 1 || g.title) && (
            <div className="row" style={{ marginBottom: 8 }}>
              <input value={g.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="שם החלק (למשל: לבצק)" />
              <button className="icon-btn" aria-label="מחיקת חלק" onClick={() => onChange(value.filter((_, j) => j !== i))}>🗑️</button>
            </div>
          )}
          <textarea rows={Math.max(4, (g.text || '').split('\n').length + 1)} value={g.text} onChange={(e) => set(i, { text: e.target.value })} placeholder={placeholder} />
        </div>
      ))}
      <button className="btn block" onClick={() => onChange([...value, { title: '', text: '' }])}>＋ חלק נוסף (למשל: מילוי, ציפוי)</button>
    </>
  );
}

export default function Editor({ draft, kitchenId, back, replace, changed, say }) {
  const init = draft || emptyRecipe();
  const [r, setR] = useState(() => ({
    ...emptyRecipe(),
    ...init,
    ingredients: (init.ingredients?.length ? init.ingredients : [{ title: '', items: [] }]).map((g) => ({ title: g.title || '', text: toText(g.items) })),
    steps: (init.steps?.length ? init.steps : [{ title: '', items: [] }]).map((g) => ({ title: g.title || '', text: toText(g.items) })),
    tipsText: toText(init.tips),
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef();
  const up = (patch) => setR((x) => ({ ...x, ...patch }));
  const images = r.source_images || [];

  const addCover = async (f) => {
    if (!f) return;
    setUploading(true);
    try { up({ image_url: await uploadImage(kitchenId, await compressImage(f, 1400)) }); } catch { say('התמונה לא עלתה, נסו שוב'); }
    setUploading(false);
  };

  const save = async () => {
    if (!r.title.trim()) { say('חסר שם למתכון'); return; }
    setSaving(true);
    try {
      const payload = {
        id: r.id || null,
        title: r.title.trim(),
        description: r.description || '',
        category: r.category || '',
        tags: r.tags || [],
        servings: r.servings || null,
        prep_minutes: r.prep_minutes || null,
        cook_minutes: r.cook_minutes || null,
        image_url: r.image_url || '',
        source_images: images,
        ingredients: r.ingredients.map((g) => ({ title: g.title.trim(), items: toItems(g.text) })).filter((g) => g.items.length),
        steps: r.steps.map((g) => ({ title: g.title.trim(), items: toItems(g.text) })).filter((g) => g.items.length),
        tips: toItems(r.tipsText),
        favorite: !!r.favorite,
      };
      const saved = await saveRecipe(kitchenId, payload);
      await changed();
      say('נשמר ✓');
      replace({ name: 'recipe', id: saved.id });
    } catch {
      say('לא נשמר, בדקו את החיבור ונסו שוב');
    }
    setSaving(false);
  };

  return (
    <div className="wrap">
      <div className="top">
        <div className="row">
          <button className="icon-btn" onClick={back} aria-label="ביטול">✕</button>
          <h1 className="h1 grow" style={{ fontSize: 20 }}>{r.id ? 'עריכת מתכון' : 'בדיקה ושמירה'}</h1>
          <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'שומרים...' : 'שמירה'}</button>
        </div>
      </div>
      {!r.id && draft?.note && <div className="tip" style={{ marginTop: 6 }}>{draft.note}</div>}

      <label className="f">שם המתכון</label>
      <input value={r.title} onChange={(e) => up({ title: e.target.value })} placeholder="למשל: עוגת שמרים של סבתא" />

      <label className="f">תמונה ראשית</label>
      <div className="thumbs">
        {r.image_url && !images.includes(r.image_url) && (
          <div className="thumb-wrap sel"><img src={r.image_url} alt="" /><button className="x" onClick={() => up({ image_url: '' })}>✕</button></div>
        )}
        {images.map((u) => (
          <button key={u} className={'thumb-wrap' + (r.image_url === u ? ' sel' : '')} onClick={() => up({ image_url: r.image_url === u ? '' : u })}><img src={u} alt="" /></button>
        ))}
        <button className="add" onClick={() => file.current?.click()} disabled={uploading}>{uploading ? '...' : '📷'}</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => addCover(e.target.files?.[0])} />
      </div>
      <p className="muted small" style={{ margin: '4px 2px' }}>לחצו על תמונה כדי לבחור אותה, או הוסיפו צילום של המנה</p>

      <div className="row" style={{ gap: 10 }}>
        <div className="grow">
          <label className="f">קטגוריה</label>
          <select value={r.category || ''} onChange={(e) => up({ category: e.target.value })}>
            <option value="">בחרו...</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ width: 100 }}>
          <label className="f">מנות</label>
          <input type="number" inputMode="numeric" value={r.servings ?? ''} onChange={(e) => up({ servings: e.target.value ? +e.target.value : null })} />
        </div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="grow">
          <label className="f">זמן הכנה (דקות)</label>
          <input type="number" inputMode="numeric" value={r.prep_minutes ?? ''} onChange={(e) => up({ prep_minutes: e.target.value ? +e.target.value : null })} />
        </div>
        <div className="grow">
          <label className="f">בישול / אפייה (דקות)</label>
          <input type="number" inputMode="numeric" value={r.cook_minutes ?? ''} onChange={(e) => up({ cook_minutes: e.target.value ? +e.target.value : null })} />
        </div>
      </div>
      <label className="f">תיאור קצר (לא חובה)</label>
      <input value={r.description || ''} onChange={(e) => up({ description: e.target.value })} />

      <Groups label="🧺 מצרכים" hint="מצרך בכל שורה, הכמות בהתחלה — כך אפשר להכפיל כמויות" value={r.ingredients} onChange={(v) => up({ ingredients: v })} placeholder={'2 כוסות קמח\n1 כפית מלח\n3 ביצים'} />
      <Groups label="📝 אופן ההכנה" hint="שלב בכל שורה. זמנים כמו ״20 דקות״ יקבלו כפתור טיימר" value={r.steps} onChange={(v) => up({ steps: v })} placeholder={'מערבבים את הקמח והמלח\nמוסיפים ביצים ולשים 5 דקות'} />

      <h2 className="h2">💡 טיפים</h2>
      <textarea value={r.tipsText} onChange={(e) => up({ tipsText: e.target.value })} placeholder="טיפ בכל שורה (לא חובה)" />

      {images.length > 0 && (
        <>
          <h2 className="h2">📄 עמודי המקור</h2>
          <div className="thumbs">
            {images.map((u) => (
              <div key={u} className="thumb-wrap"><img src={u} alt="" /><button className="x" onClick={() => up({ source_images: images.filter((x) => x !== u), image_url: r.image_url === u ? '' : r.image_url })}>✕</button></div>
            ))}
          </div>
        </>
      )}

      <button className="btn primary big block" style={{ marginTop: 26 }} disabled={saving} onClick={save}>{saving ? 'שומרים...' : 'שמירת המתכון'}</button>
    </div>
  );
}
