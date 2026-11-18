'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, ai, errText } from '@/lib/api';
import { parseChat, groupMessages, readChatFile } from '@/lib/whatsapp';
import { resolveSuggested } from '@/lib/tags';
import { typeOf, norm, KINDS } from '@/lib/kb';

const BATCH = 45;
const saveKey = (shop) => 'kb_import_' + shop;

// ייבוא צ'אט וואטסאפ: קוראים את הקובץ, ה-AI הופך הודעות לפריטים מסודרים, העובד עובר ומאשר.
export default function Importer({ ctx, file }) {
  const [step, setStep] = useState('pick'); // pick → senders → run → review → done
  const [msgs, setMsgs] = useState([]);
  const [senders, setSenders] = useState({});
  const [from, setFrom] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [pos, setPos] = useState(0);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(0);
  const stopRef = useRef(false);
  const fileRef = useRef(null);
  const tagsForAI = useMemo(() => ctx.tags.map((x) => ({ kind: x.kind, name: x.name })), [ctx.tags]);
  const existingTitles = useMemo(() => new Set(ctx.items.map((x) => norm(x.title))), [ctx.items]);

  // המשך ייבוא שלא הסתיים
  const [resume, setResume] = useState(() => { try { return JSON.parse(localStorage.getItem(saveKey(ctx.shopId)) || 'null'); } catch { return null; } });
  useEffect(() => { if (file) load(file); }, []); // eslint-disable-line
  useEffect(() => {
    if (step !== 'run' && step !== 'review') return;
    try { localStorage.setItem(saveKey(ctx.shopId), JSON.stringify({ msgs, drafts, pos, at: Date.now() })); } catch {}
  }, [drafts, pos, step]); // eslint-disable-line

  async function load(f) {
    setErr('');
    try {
      const all = parseChat(await readChatFile(f));
      if (!all.length) { setErr('לא מצאתי הודעות בקובץ. צריך את הקובץ שוואטסאפ מייצא (txt או zip).'); return; }
      const c = {};
      for (const m of all) c[m.from] = (c[m.from] || 0) + 1;
      setSenders(c);
      setMsgs(all);
      const names = Object.keys(c);
      if (names.length > 1) setStep('senders'); else start(all, '');
    } catch (e) { setErr(errText(e)); }
  }

  function start(all, who) {
    const g = groupMessages(who ? all.filter((m) => m.from === who) : all);
    setMsgs(g); setDrafts([]); setPos(0); setStep('run');
  }

  async function run(list = msgs, startAt = pos) {
    setRunning(true); setErr(''); stopRef.current = false;
    let p = startAt;
    let fails = 0;
    while (p < list.length && !stopRef.current) {
      const batch = list.slice(p, p + BATCH);
      try {
        const r = await ai({ mode: 'import', shop: ctx.shopId, tags: tagsForAI, messages: batch.map((m) => ({ i: m.i, text: m.text, at: (m.at || '').slice(0, 10) })) });
        const add = r.items.map((s) => {
          const { ids, fresh } = resolveSuggested(ctx.tags, s);
          const dup = existingTitles.has(norm(s.title));
          return { key: crypto.randomUUID(), type: s.type, title: s.title, body: s.body, fields: s.fields, tag_ids: ids, fresh, photos: [], pinned: false, on: !dup, dup, src: s.src };
        });
        setDrafts((d) => [...d, ...add]);
        p += batch.length; setPos(p); fails = 0;
      } catch (e) {
        fails++;
        if (fails >= 3) { setErr(errText(e) + ' — אפשר להמשיך אחר כך מאותה נקודה'); break; }
        await new Promise((r) => setTimeout(r, 3000 * fails));
      }
    }
    setRunning(false);
    if (p >= list.length) setStep('review');
  }
  useEffect(() => { if (step === 'run' && !running && pos === 0 && msgs.length) run(); }, [step]); // eslint-disable-line

  async function saveAll() {
    const chosen = drafts.filter((x) => x.on);
    if (!chosen.length) return;
    setRunning(true); setErr('');
    try {
      // יוצרים פעם אחת כל תגית חדשה
      const created = {};
      const keyOf = (f) => f.kind + ':' + norm(f.name);
      const all = [];
      for (const d of chosen) for (const f of d.fresh) if (!created[keyOf(f)] && !all.some((x) => keyOf(x) === keyOf(f))) all.push(f);
      for (const f of all) { const t = await api.saveTag(ctx.shopId, f); created[keyOf(f)] = t; }
      ctx.applyTags(Object.values(created));
      const items = chosen.map((d) => ({
        type: d.type, title: d.title, body: d.body, fields: d.fields, photos: [], pinned: false, source: 'whatsapp',
        tag_ids: [...new Set([...d.tag_ids, ...d.fresh.map((f) => created[keyOf(f)]?.id).filter(Boolean)])],
      }));
      for (let i = 0; i < items.length; i += 100) {
        await api.saveItems(ctx.shopId, items.slice(i, i + 100));
        setSaved(Math.min(items.length, i + 100));
      }
      try { localStorage.removeItem(saveKey(ctx.shopId)); } catch {}
      await ctx.refresh();
      setStep('done');
    } catch (e) { setErr(errText(e)); }
    setRunning(false);
  }

  const onCount = drafts.filter((x) => x.on).length;
  const allNewTags = useMemo(() => {
    const m = new Map();
    for (const d of drafts) if (d.on) for (const f of d.fresh) m.set(f.kind + ':' + norm(f.name), f);
    return [...m.values()];
  }, [drafts]);

  return (
    <Sheet onClose={() => { if (!running) ctx.close(); }}>
      <div className="sheet-head">
        <h2>💬 ייבוא מוואטסאפ</h2>
        <button className="icon-btn" onClick={() => { stopRef.current = true; ctx.close(); }} aria-label="סגירה">✕</button>
      </div>

      {step === 'pick' && (
        <>
          {resume?.msgs?.length > 0 && (
            <div className="notice info-box">
              יש ייבוא שלא הסתיים ({resume.drafts.length} פריטים מוכנים, {Math.round((resume.pos / resume.msgs.length) * 100)}% מהצ'אט).
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn sm primary" onClick={() => { setMsgs(resume.msgs); setDrafts(resume.drafts); setPos(resume.pos); setStep(resume.pos >= resume.msgs.length ? 'review' : 'run'); }}>להמשיך</button>
                <button className="btn sm" onClick={() => { try { localStorage.removeItem(saveKey(ctx.shopId)); } catch {} setResume(null); }}>להתחיל מחדש</button>
              </div>
            </div>
          )}
          <div className="card pad">
            <b>איך מוציאים את הצ'אט מוואטסאפ?</b>
            <ol style={{ margin: '8px 0 0', paddingInlineStart: 20, lineHeight: 1.8 }}>
              <li>פותחים את הצ'אט שבו רשמת את המידע</li>
              <li>אנדרואיד: לוחצים על ⋮ ← <b>עוד</b> ← <b>ייצוא צ'אט</b>. אייפון: לוחצים על שם הצ'אט למעלה ← <b>ייצוא צ'אט</b></li>
              <li>בוחרים <b>ללא מדיה</b></li>
              <li>בוחרים באפליקציה <b>"מידע"</b> (אם היא מותקנת) — או שומרים את הקובץ ובוחרים אותו כאן</li>
            </ol>
          </div>
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => fileRef.current?.click()}>📂 בחירת קובץ הצ'אט (txt / zip)</button>
          <input ref={fileRef} type="file" accept=".txt,.zip,text/plain,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }} />
          <div className="muted small" style={{ marginTop: 10 }}>המערכת תעבור על כל ההודעות, תדלג על שיחה סתמית, ותסדר כל מידע לפי חברות, מכשירים ונושאים. בסוף אתה עובר ומאשר לפני שזה נשמר.</div>
        </>
      )}

      {step === 'senders' && (
        <>
          <div className="muted">בצ'אט יש כמה אנשים. של מי ההודעות לייבא?</div>
          <div className="card menu-list" style={{ marginTop: 10 }}>
            <button onClick={() => start(msgs, '')}><span className="e">👥</span><span className="grow">כולם</span><span className="muted">{msgs.length}</span></button>
            {Object.entries(senders).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
              <button key={n} onClick={() => { setFrom(n); start(msgs, n); }}><span className="e">👤</span><span className="grow">{n}</span><span className="muted">{c}</span></button>
            ))}
          </div>
        </>
      )}

      {step === 'run' && (
        <div className="card pad" style={{ marginTop: 6 }}>
          <b>{running ? 'מסדר את המידע…' : 'עצרנו באמצע'}</b>
          <div className="muted small" style={{ margin: '4px 0 10px' }}>{pos} מתוך {msgs.length} הודעות{from ? ` של ${from}` : ''} · נמצאו {drafts.length} פריטי מידע</div>
          <div className="progress"><div style={{ width: `${msgs.length ? (pos / msgs.length) * 100 : 0}%` }} /></div>
          <div className="row" style={{ marginTop: 12 }}>
            {running ? <button className="btn" onClick={() => { stopRef.current = true; }}>⏸ עצירה</button>
              : <button className="btn primary" onClick={() => run()}>▶ להמשיך</button>}
            {drafts.length > 0 && <button className="btn" disabled={running} onClick={() => setStep('review')}>לעבור על מה שיש ({drafts.length})</button>}
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>אפשר לסגור ולחזור אחר כך — ההתקדמות נשמרת בטלפון.</div>
        </div>
      )}

      {step === 'review' && (
        <>
          <div className="notice info-box">
            עבור על הפריטים: לחיצה על פריט = עריכה, ✓ = לשמור. {drafts.some((x) => x.dup) && 'פריטים שכנראה כבר קיימים לא מסומנים.'}
          </div>
          {pos < msgs.length && <button className="btn sm" onClick={() => setStep('run')}>עוד {msgs.length - pos} הודעות לא עובדו — להמשיך</button>}
          <div className="row" style={{ margin: '8px 0' }}>
            <b className="grow">{onCount} מתוך {drafts.length} נבחרו</b>
            <button className="btn sm" onClick={() => setDrafts((d) => d.map((x) => ({ ...x, on: true })))}>בחר הכל</button>
            <button className="btn sm" onClick={() => setDrafts((d) => d.map((x) => ({ ...x, on: false })))}>נקה</button>
          </div>
          {allNewTags.length > 0 && (
            <div className="small muted" style={{ marginBottom: 8 }}>
              ייווצרו תגיות חדשות: {KINDS.map((k) => allNewTags.filter((f) => f.kind === k.k).map((f) => f.name).join(', ')).filter(Boolean).join(' · ')}
            </div>
          )}
          {drafts.map((x, i) => (
            <div key={x.key} className="card it" style={{ opacity: x.on ? 1 : 0.55 }}>
              <button className={'check' + (x.on ? ' on' : '')} style={{ marginTop: 8 }} onClick={() => setDrafts((d) => d.map((y, j) => (j === i ? { ...y, on: !y.on } : y)))}>{x.on ? '✓' : ''}</button>
              <button className="grow" style={{ textAlign: 'start' }} onClick={() => ctx.open({ t: 'edit', draft: x, onDone: (nd) => setDrafts((d) => d.map((y) => (y.key === x.key ? { ...y, ...nd, on: true } : y))) })}>
                <div className="t">{typeOf(x.type).e} {x.title || typeOf(x.type).label}{x.dup && <span className="muted small"> · כבר קיים?</span>}</div>
                <div className="s">{Object.values(x.fields || {}).join(' · ') || x.body}</div>
                <div className="tg">
                  {x.tag_ids.map((id) => ctx.tagsById[id]).filter(Boolean).map((t) => <span key={t.id} className={'tag-mini k-' + t.kind}>{t.name}</span>)}
                  {x.fresh.map((f) => <span key={f.kind + f.name} className={'tag-mini k-' + f.kind}>✚ {f.name}</span>)}
                </div>
              </button>
            </div>
          ))}
          {!drafts.length && <div className="empty"><div className="e">🤔</div>לא נמצא מידע שימושי בצ'אט</div>}
          {running && <div className="muted center" style={{ margin: 8 }}>שומר… {saved}/{onCount}</div>}
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--card)', padding: '10px 0' }}>
            <button className="btn primary block" disabled={running || !onCount} onClick={saveAll}>{running ? 'שומר…' : `💾 שמירת ${onCount} פריטים`}</button>
          </div>
        </>
      )}

      {step === 'done' && (
        <div className="empty">
          <div className="e">🎉</div>
          <b>נשמרו {saved} פריטים!</b>
          <div className="muted" style={{ marginTop: 6 }}>עכשיו כל העובדים רואים אותם, מסודרים לפי חברות, מכשירים ונושאים.</div>
          <button className="btn primary" style={{ marginTop: 16 }} onClick={ctx.close}>מעולה</button>
        </div>
      )}
      {err && <div className="err">{err}</div>}
    </Sheet>
  );
}
