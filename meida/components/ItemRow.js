'use client';
import { typeOf, ALL_FIELDS, timeAgo } from '@/lib/kb';

// מסמן את מילות החיפוש בכותרת
function Hi({ text, words }) {
  if (!words?.length || !text) return text || null;
  const lower = text.toLowerCase();
  let best = null;
  for (const w of words) { const i = lower.indexOf(w); if (i >= 0 && (!best || i < best[0])) best = [i, w.length]; }
  if (!best) return text;
  return <>{text.slice(0, best[0])}<mark>{text.slice(best[0], best[0] + best[1])}</mark>{text.slice(best[0] + best[1])}</>;
}

export default function ItemRow({ it, ctx, words, showWho }) {
  const t = typeOf(it.type);
  const f = it.fields || {};
  const sub = ALL_FIELDS.filter((k) => f[k]).slice(0, 2).map((k) => f[k]).join(' · ') || it.body;
  const tg = (it.tag_ids || []).map((id) => ctx.tagsById[id]).filter(Boolean).slice(0, 5);
  return (
    <button className="card it" onClick={() => ctx.openItem(it)}>
      <div className="ic">{it.photos?.[0] ? <img src={it.photos[0]} alt="" loading="lazy" /> : t.e}</div>
      <div className="grow">
        <div className="t">{it.pinned && <span className="pin">📌 </span>}<Hi text={it.title || t.label} words={words} /></div>
        {sub && <div className="s">{sub}</div>}
        <div className="tg">
          {tg.map((x) => <span key={x.id} className={'tag-mini k-' + x.kind}>{x.name}</span>)}
          {showWho && <span className="muted small">{it.updated_by_name} · {timeAgo(it.updated_at)}</span>}
        </div>
      </div>
    </button>
  );
}
