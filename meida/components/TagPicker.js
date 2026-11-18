'use client';
import { useMemo, useState } from 'react';
import { KINDS, norm } from '@/lib/kb';

// בחירת חברות / מכשירים / נושאים. אפשר לבחור כמה מכל סוג, ולהוסיף חדשים.
export default function TagPicker({ tags, ids, fresh = [], onChange }) {
  const [q, setQ] = useState({});
  const [more, setMore] = useState({});
  const live = useMemo(() => tags.filter((t) => !t.deleted_at), [tags]);
  const byId = useMemo(() => Object.fromEntries(live.map((t) => [t.id, t])), [live]);

  const toggle = (id) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id], fresh);
  const addNew = (kind, name) => {
    name = name.trim();
    if (!name) return;
    const ex = live.find((t) => t.kind === kind && norm(t.name) === norm(name));
    if (ex) { if (!ids.includes(ex.id)) onChange([...ids, ex.id], fresh); }
    else if (!fresh.some((f) => f.kind === kind && norm(f.name) === norm(name))) {
      const comp = kind === 'device' ? ids.map((i) => byId[i]).find((t) => t?.kind === 'company') : null;
      onChange(ids, [...fresh, { kind, name, parent_id: comp?.id }]);
    }
    setQ((s) => ({ ...s, [kind]: '' }));
  };

  return KINDS.map((k) => {
    const selected = ids.map((i) => byId[i]).filter((t) => t?.kind === k.k);
    const nf = fresh.filter((f) => f.kind === k.k);
    const text = q[k.k] || '';
    const w = norm(text);
    const pool = live.filter((t) => t.kind === k.k && !ids.includes(t.id));
    const sugg = w ? pool.filter((t) => norm(t.name).includes(w)).slice(0, 10) : pool.slice(0, more[k.k] ? 200 : k.k === 'device' ? 6 : 10);
    return (
      <div key={k.k} style={{ marginTop: 10 }}>
        <label className="lbl" style={{ marginTop: 0 }}>{k.e} {k.label}</label>
        <div className="chips wrapped" style={{ paddingTop: 0 }}>
          {selected.map((t) => <button type="button" key={t.id} className={'chip on k-' + k.k} onClick={() => toggle(t.id)}>{t.name} ✕</button>)}
          {nf.map((f) => <button type="button" key={'n' + f.name} className={'chip on k-' + k.k} onClick={() => onChange(ids, fresh.filter((x) => x !== f))}>✚ {f.name} ✕</button>)}
          {sugg.map((t) => <button type="button" key={t.id} className={'chip k-' + k.k} style={{ opacity: .8 }} onClick={() => toggle(t.id)}>+ {t.name}</button>)}
          {!w && pool.length > sugg.length && <button type="button" className="chip add" onClick={() => setMore((m) => ({ ...m, [k.k]: true }))}>עוד {pool.length - sugg.length}…</button>}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          <input className="input" style={{ height: 38 }} placeholder={`חיפוש או ${k.one} חדש…`} value={text}
            onChange={(e) => setQ((s) => ({ ...s, [k.k]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sugg.length && norm(sugg[0].name) === w ? toggle(sugg[0].id) || setQ((s) => ({ ...s, [k.k]: '' })) : addNew(k.k, text); } }} />
          {text.trim() && !live.some((t) => t.kind === k.k && norm(t.name) === w) && <button type="button" className="btn sm" onClick={() => addNew(k.k, text)}>הוסף</button>}
        </div>
      </div>
    );
  });
}
