'use client';
import { typeOf, ALL_FIELDS, timeAgo, catOf, coOf } from '@/lib/kb';
import CoLogo from './CoLogo';

// מסמן את מילות החיפוש בכותרת
function Hi({ text, words }) {
  if (!words?.length || !text) return text || null;
  const lower = text.toLowerCase();
  let best = null;
  for (const w of words) { const i = lower.indexOf(w); if (i >= 0 && (!best || i < best[0])) best = [i, w.length]; }
  if (!best) return text;
  return <>{text.slice(0, best[0])}<mark>{text.slice(best[0], best[0] + best[1])}</mark>{text.slice(best[0] + best[1])}</>;
}

export default function ItemRow({ it, ctx, words, showWho, hideCat }) {
  const t = typeOf(it.type, ctx.shop);
  const f = it.fields || {};
  const co = coOf(it, ctx.tagsById);
  const cat = catOf(it, ctx.tagsById);
  const sub = ALL_FIELDS.filter((k) => f[k]).slice(0, 2).map((k) => f[k]).join(' · ') || it.body;
  const where = [co?.name, !hideCat && cat?.name].filter(Boolean).join(' · ');
  return (
    <button className="card it" onClick={() => ctx.openItem(it)}>
      <div className="ic">{it.photos?.[0] ? <img src={it.photos[0]} alt="" loading="lazy" /> : co ? <CoLogo co={co} size={40} /> : t.e}</div>
      <div className="grow">
        <div className="t">{it.pinned && <span className="pin">📌 </span>}<Hi text={it.title || t.label} words={words} /></div>
        {sub && <div className="s">{sub}</div>}
        {(where || showWho) && <div className="tg">
          {where && <span className="muted small">{t.e} {where}</span>}
          {showWho && <span className="muted small">{it.updated_by_name} · {timeAgo(it.updated_at)}</span>}
        </div>}
      </div>
    </button>
  );
}
