'use client';
import { useEffect, useState } from 'react';
import { api, errText } from '@/lib/api';

// דוחות בונוסים חודשיים שמגיעים מיומן הבונוסים (רק מנהלים)
const BONUS_APP = 'https://newphone-bonus.vercel.app';
const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const monthLabel = (k) => { const [y, m] = String(k).split('-'); return `${MONTHS[+m - 1] || ''} ${y}`; };
const ils = (n) => '₪' + Number(n || 0).toLocaleString('he-IL');
const num = (n) => Number(n || 0).toLocaleString('he-IL');
const when = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('he-IL') + ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function Connect({ ctx, has }) {
  const [busy, setBusy] = useState(false);
  async function go(fresh) {
    if (fresh && !confirm('ליצור קישור חדש? הקישור הקודם יפסיק לעבוד, ויהיה צריך לחבר שוב את יומן הבונוסים.')) return;
    setBusy(true);
    try {
      const t = await api.bonusLink(ctx.shopId, fresh);
      location.href = `${BONUS_APP}/?meida=${encodeURIComponent(t)}`;
    } catch (e) { ctx.toast(errText(e)); setBusy(false); }
  }
  return (
    <div className="card pad" style={{ marginTop: 12 }}>
      <b>🔗 חיבור ליומן הבונוסים</b>
      <div className="muted small" style={{ marginTop: 4 }}>
        {has ? 'יומן הבונוסים כבר שולח לכאן. אפשר לחבר שוב (למשל מטלפון אחר של המנהל).'
          : 'לוחצים, נפתח יומן הבונוסים (מחוברים שם כמנהל הצוות), והחיבור נשמר. מאז, בכל ראשון לחודש היומן ישאל אם לשתף את החודש הקודם.'}
      </div>
      <div className="row wrap-row" style={{ marginTop: 10 }}>
        <button className="btn primary" disabled={busy} onClick={() => go(false)}>{busy ? 'פותח…' : has ? 'חיבור שוב' : 'חבר את יומן הבונוסים'}</button>
        {has && <button className="btn sm" disabled={busy} onClick={() => go(true)}>קישור חדש</button>}
      </div>
    </div>
  );
}

function Employees({ list, by }) {
  const [open, setOpen] = useState('');
  const sorted = [...list].sort((a, b) => (by === 'cnt' ? b.cnt - a.cnt || b.total - a.total : b.total - a.total));
  if (!sorted.length) return <div className="muted center" style={{ padding: 20 }}>אין עובדים בדוח הזה.</div>;
  return sorted.map((e, i) => {
    const key = (e.name || '') + i;
    return (
      <div className="card bn-emp" key={key}>
        <button className="bn-emp-h" onClick={() => setOpen(open === key ? '' : key)} aria-expanded={open === key}>
          <span className="avatar">{(e.name || '?').charAt(0)}</span>
          <span className="grow" style={{ minWidth: 0 }}>
            <b>{e.name || 'עובד'}</b>
            <div className="muted small">{num(e.cnt)} בונוסים{e.ultra ? ` · ${num(e.ultra)} אולטרה` : ''}</div>
          </span>
          <span className="bn-sum">
            <b>{by === 'cnt' ? `${num(e.cnt)} יח׳` : ils(e.total)}</b>
            {e.paid ? <span className="bn-pill">💸 שולם</span> : e.approved ? <span className="bn-pill">✓ אושר</span> : e.cnt && e.approved === false ? <span className="bn-pill wait">לא אושר</span> : null}
          </span>
        </button>
        {open === key && (
          <div className="bn-det">
            {by === 'cnt' && <div className="bn-r"><b>סה״כ</b><span /><b>{ils(e.total)}</b></div>}
            {(e.cats || []).map((c) => <div className="bn-r" key={c.name}><span>{c.name}</span><span>{num(c.n)} יח׳</span><span>{ils(c.sum)}</span></div>)}
            {(e.types || []).length > 0 && <div className="muted small" style={{ marginTop: 4 }}>מה מכר</div>}
            {(e.types || []).map((t) => <div className="bn-r" key={t.cat + t.name}><span>{t.name} <span className="muted small">· {t.cat}</span></span><span>{num(t.n)} יח׳</span><span>{ils(t.sum)}</span></div>)}
          </div>
        )}
      </div>
    );
  });
}

function Types({ list }) {
  if (!list.length) return <div className="muted center" style={{ padding: 20 }}>אין נתונים.</div>;
  const max = list[0].sum || 1;
  return (
    <div className="card pad" style={{ display: 'grid', gap: 10 }}>
      {list.map((t) => (
        <div key={t.cat + t.name}>
          <div className="bn-r"><span>{t.name} <span className="muted small">· {t.cat}</span></span><span>{num(t.n)} יח׳</span><b>{ils(t.sum)}</b></div>
          <div className="bn-bar"><i style={{ width: Math.max(3, Math.round(t.sum / max * 100)) + '%' }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function Bonus({ ctx, back }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [i, setI] = useState(0);
  const [by, setBy] = useState('emp');
  useEffect(() => { api.bonusList(ctx.shopId).then((l) => setList(l || [])).catch((e) => { setErr(errText(e)); setList([]); }); }, [ctx.shopId]);

  const head = <div className="row" style={{ marginBottom: 10 }}><button className="btn sm" onClick={back}>→ חזרה</button><b className="grow">💰 בונוסים</b></div>;
  if (!ctx.isAdmin) return <>{head}<div className="muted">רק מנהל רואה את דוחות הבונוסים.</div></>;
  if (list === null) return <>{head}<div className="muted center" style={{ padding: 30 }}>טוען…</div></>;
  const r = list[i];
  const d = r?.data || {};
  const cats = d.cats || [];
  return (
    <>
      {head}
      {err && <div className="err">{err}</div>}
      {!r ? (
        <div className="card pad center"><b>עוד לא הגיע דוח</b><div className="muted small" style={{ marginTop: 4 }}>אחרי החיבור, בראשון לחודש יומן הבונוסים ישאל אם לשתף את החודש הקודם. אחרי האישור הדוח יופיע כאן.</div></div>
      ) : (
        <>
          <div className="card bn-mon">
            <button className="icon-btn" disabled={i >= list.length - 1} onClick={() => setI(i + 1)} aria-label="חודש קודם">›</button>
            <span className="center"><b>{monthLabel(r.month)}</b>{d.team && <div className="muted small">{d.team}</div>}</span>
            <button className="icon-btn" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="חודש הבא">‹</button>
          </div>
          <div className="bn-kpis">
            <div className="card bn-kpi"><b>{ils(d.total)}</b><span className="muted small">סה״כ</span></div>
            <div className="card bn-kpi"><b>{num(d.cnt)}</b><span className="muted small">בונוסים</span></div>
            <div className="card bn-kpi"><b>{num(d.ultra)}</b><span className="muted small">אולטרה</span></div>
          </div>
          {cats.length > 0 && (
            <div className="card pad" style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              {cats.map((c) => <div className="bn-r" key={c.name}><span>{c.name}</span><span>{num(c.n)} יח׳</span><b>{ils(c.sum)}</b></div>)}
            </div>
          )}
          <div className="seg">
            <button className={by === 'emp' ? 'on' : ''} onClick={() => setBy('emp')}>לפי עובד</button>
            <button className={by === 'cnt' ? 'on' : ''} onClick={() => setBy('cnt')}>לפי כמות</button>
            <button className={by === 'type' ? 'on' : ''} onClick={() => setBy('type')}>לפי סוג</button>
          </div>
          <div className="h2">{by === 'type' ? 'מה הכי נמכר' : by === 'cnt' ? 'לפי כמות בונוסים (לחיצה = פירוט)' : 'עובדים (לחיצה = פירוט)'}</div>
          {by === 'type' ? <Types list={d.types || []} /> : <Employees list={d.members || []} by={by} />}
          <div className="muted small center" style={{ marginTop: 10 }}>שותף {when(r.sent_at)}{r.sent_by ? ` · ${r.sent_by}` : ''} מיומן הבונוסים</div>
        </>
      )}
      <Connect ctx={ctx} has={list.length > 0} />
    </>
  );
}
