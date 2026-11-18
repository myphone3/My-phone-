'use client';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import { ai, api, errText } from '@/lib/api';
import { queryWords, score, norm } from '@/lib/kb';
import ItemRow from '@/components/ItemRow';

const STOP = new Set(['מה', 'איך', 'איפה', 'מי', 'יש', 'של', 'את', 'על', 'עם', 'זה', 'לי', 'אני', 'צריך', 'אפשר', 'הוא', 'היא', 'כמה', 'למה', 'מתי', 'או', 'גם', 'אם', 'the']);

// שאלה חופשית: מוצאים את הפריטים הקרובים ביותר, וה-AI עונה רק לפיהם
export default function Ask({ ctx, q0 }) {
  const [q, setQ] = useState(q0 || '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  async function ask() {
    if (!q.trim()) return;
    setBusy(true); setErr(''); setRes(null);
    try {
      const words = queryWords(q).filter((w) => !STOP.has(w) && w.length > 1)
        .map((w) => (w.length > 3 && /^[ובלהמש]/.test(w) ? w.slice(1) : w)); // "בסמסונג" ← "סמסונג"
      const scored = ctx.items.map((it) => {
        const ix = ctx.index.get(it.id);
        let s = 0;
        for (const w of words) s += score(ix, [w], '');
        return [s, it];
      }).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 35).map((x) => x[1]);
      const pool = scored.length ? scored : ctx.items.slice(0, 35);
      const r = await ai({
        mode: 'ask', shop: ctx.shopId, question: q,
        items: pool.map((it) => ({ id: it.id, title: it.title, fields: it.fields, body: it.body, tags: (it.tag_ids || []).map((t) => ctx.tagsById[t]?.name).filter(Boolean).join(', ') })),
      });
      const found = r.ids.map((id) => ctx.items.find((x) => x.id === id)).filter(Boolean);
      if (!found.length) api.miss(ctx.shopId, q).catch(() => {});
      setRes({ answer: r.answer, items: found });
    } catch (e) { setErr(errText(e)); }
    setBusy(false);
  }

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>✨ שאל את המאגר</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <div className="muted small" style={{ marginBottom: 8 }}>שאלה חופשית, והתשובה נלקחת רק מהמידע של החנות. למשל: "איפה מתקנים מסך לשיאומי?", "מה הקוד לבדיקת סוללה באייפון?"</div>
      <textarea className="input" rows={2} style={{ minHeight: 60 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="מה רוצים לדעת?" autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} />
      <button className="btn primary block" style={{ marginTop: 8 }} disabled={busy || !q.trim()} onClick={ask}>{busy ? <><span className="spin sm" /> מחפש…</> : 'שאל'}</button>
      {err && <div className="err">{err}</div>}
      {res && (
        <div style={{ marginTop: 14 }}>
          <div className="answer">{res.answer}</div>
          {res.items.length > 0 && <><div className="h2">מבוסס על</div>{res.items.map((it) => <ItemRow key={it.id} it={it} ctx={ctx} />)}</>}
          {!res.items.length && <button className="btn" style={{ marginTop: 10 }} onClick={() => ctx.replace({ t: 'edit', draft: { title: q } })}>➕ להוסיף את התשובה למאגר</button>}
        </div>
      )}
    </Sheet>
  );
}
