'use client';
import { useMemo, useState } from 'react';
import { savePlan } from '@/lib/api';
import { nextDays, dayKey, groups, shareText } from '@/lib/recipe';
import { Sheet, emojiFor, metaLine } from './ui';

function cleanPlan(plan) {
  const today = dayKey(new Date());
  return Object.fromEntries(Object.entries(plan || {}).filter(([k, v]) => k >= today && v?.length));
}

export function usePlan({ data, kitchenId, changed, say }) {
  const plan = data?.kitchen?.plan || {};
  const save = async (next) => {
    try { await savePlan(kitchenId, cleanPlan(next)); await changed(); } catch { say('לא נשמר, נסו שוב'); }
  };
  const add = (day, id) => save({ ...plan, [day]: [...new Set([...(plan[day] || []), id])] });
  const remove = (day, id) => save({ ...plan, [day]: (plan[day] || []).filter((x) => x !== id) });
  return { plan, add, remove };
}

export function PlanView(props) {
  const { recipes, back, go, openSheet } = props;
  const { plan, remove } = usePlan(props);
  const days = nextDays(7);
  const byId = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const planned = days.flatMap((d) => (plan[d.key] || []).map((id) => byId[id]).filter(Boolean));

  const shopping = () => {
    if (!planned.length) return;
    const lines = ['🛒 *קניות לתפריט השבוע*'];
    for (const r of [...new Map(planned.map((r) => [r.id, r])).values()]) {
      lines.push('', `*${r.title}*`);
      groups(r.ingredients).forEach((g) => g.items.forEach((i) => lines.push('• ' + i)));
    }
    shareText(lines.join('\n'), 'קניות לשבוע');
  };

  return (
    <div className="wrap">
      <div className="top">
        <div className="row">
          <button className="icon-btn" onClick={back} aria-label="חזרה">→</button>
          <h1 className="h1 grow">📅 תפריט השבוע</h1>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>המתכונים של היום יופיעו גם במסך הבית של הטלוויזיה.</p>
      {days.map((d, i) => (
        <div key={d.key} className={'day' + (i === 0 ? ' today' : '')}>
          <h4><span>{d.label}</span><span className="muted small">{d.date}</span></h4>
          {(plan[d.key] || []).map((id) => byId[id]).filter(Boolean).map((r) => (
            <div key={r.id} className="it">
              <button className="row grow" style={{ textAlign: 'start' }} onClick={() => go({ name: 'recipe', id: r.id })}>
                {r.image_url ? <img src={r.image_url} alt="" /> : <span className="em">{emojiFor(r)}</span>}
                <span className="grow"><b style={{ fontSize: 14 }}>{r.title}</b><br /><small className="muted">{metaLine(r)}</small></span>
              </button>
              <button className="mini" onClick={() => remove(d.key, r.id)} aria-label="הסרה">✕</button>
            </div>
          ))}
          <button className="btn soft" style={{ minHeight: 36, fontSize: 14, marginTop: 4 }} onClick={() => openSheet('plan-pick', { day: d.key, dayLabel: d.label })}>＋ הוספת מתכון</button>
        </div>
      ))}
      <button className="btn primary big block" style={{ marginTop: 10 }} disabled={!planned.length} onClick={shopping}>🛒 רשימת קניות לכל השבוע</button>
    </div>
  );
}

// בחירת יום למתכון (מתוך דף המתכון)
export function PlanAddSheet(props) {
  const { recipe, onClose, say } = props;
  const { plan, add, remove } = usePlan(props);
  return (
    <Sheet onClose={onClose}>
      <h3>📅 מתי מכינים את {recipe.title}?</h3>
      {nextDays(7).map((d) => {
        const on = (plan[d.key] || []).includes(recipe.id);
        return (
          <button key={d.key} className="option" onClick={() => { on ? remove(d.key, recipe.id) : add(d.key, recipe.id); if (!on) say(`נוסף ל${d.label} ✓`); }}>
            <span className="oi">{on ? '✅' : '📅'}</span><span><b>{d.label}</b><small>{d.date}</small></span>
          </button>
        );
      })}
    </Sheet>
  );
}

// בחירת מתכון ליום (מתוך התפריט)
export function PlanPickSheet(props) {
  const { recipes, day, dayLabel, onClose } = props;
  const { add } = usePlan(props);
  const [q, setQ] = useState('');
  const list = recipes.filter((r) => !q || r.title.includes(q));
  return (
    <Sheet onClose={onClose}>
      <h3>מה מבשלים {dayLabel === 'היום' || dayLabel === 'מחר' ? dayLabel : `ביום ${dayLabel}`}?</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש..." style={{ marginBottom: 10 }} />
      <div className="pick">
        {list.map((r) => (
          <button key={r.id} className="music-item" onClick={() => { add(day, r.id); onClose(); }}>
            <span className="mthumb">{r.image_url ? <img src={r.image_url} alt="" /> : emojiFor(r)}</span>
            <span className="grow"><b className="mt">{r.title}</b><small className="muted">{metaLine(r)}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
