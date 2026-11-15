'use client';
import { useState } from 'react';
import { askChef } from '@/lib/api';
import { Sheet } from './ui';

const SUGGEST = ['במה אפשר להחליף ביצים?', 'איך עושים את זה פרווה?', 'כמה זה בגרמים?', 'אפשר להקפיא?', 'מה להגיש לצד זה?', 'איך יודעים שזה מוכן?'];

export default function ChefSheet({ recipe, step, cast, onClose, initial }) {
  const [q, setQ] = useState(initial || '');
  const [chat, setChat] = useState([]);
  const [busy, setBusy] = useState(false);

  const ask = async (text = q) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ('');
    const history = chat.flatMap((c) => [{ role: 'user', text: c.q }, { role: 'assistant', text: c.a }]);
    setChat((c) => [...c, { q: question, a: '' }]);
    setBusy(true);
    let a;
    try { a = await askChef(recipe, question, history, step); } catch (e) { a = e.message; }
    setChat((c) => c.map((x, i) => (i === c.length - 1 ? { ...x, a } : x)));
    setBusy(false);
  };

  return (
    <Sheet onClose={onClose}>
      <h3>👩‍🍳 שאלו את השף</h3>
      <p className="muted small" style={{ marginTop: -6 }}>על {recipe.title}: תחליפים, המרות, טיפים, מה עושים אם משהו לא הצליח</p>
      {!chat.length && (
        <div className="chips" style={{ flexWrap: 'wrap' }}>
          {SUGGEST.map((s) => <button key={s} className="chip" onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}
      {chat.map((c, i) => (
        <div key={i} style={{ margin: '12px 0' }}>
          <div className="bubble me">{c.q}</div>
          <div className="bubble">{c.a || <span className="muted">חושב...</span>}</div>
          {c.a && cast.tvOnline && (
            <button className="btn soft" style={{ minHeight: 34, fontSize: 13, marginTop: 4 }} onClick={() => cast.send('notice', { chef: { q: c.q, a: c.a } })}>📺 להציג בטלוויזיה</button>
          )}
        </div>
      ))}
      <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="מה תרצו לשאול?" enterKeyHint="send" />
        <button className="btn primary" disabled={busy || !q.trim()} type="submit">שאלה</button>
      </form>
    </Sheet>
  );
}
