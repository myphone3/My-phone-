'use client';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import { api, errText } from '@/lib/api';
import { untilLabel, untilPreset, today, timeAgo } from '@/lib/kb';

const PRESETS = [['today', 'היום'], ['week', 'עד סוף השבוע'], ['month', 'עד סוף החודש'], ['none', 'בלי תאריך']];

// מבצעים: כל עובד יכול להוסיף, לשנות ולמחוק. מבצע נעלם לבד אחרי התאריך.
export default function Deals({ ctx }) {
  const list = ctx.deals.filter((d) => !d.deleted_at).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const blank = { id: null, title: '', details: '', until: today() };
  const [d, setD] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  async function save() {
    if (!d.title.trim()) { setErr('מה המבצע?'); return; }
    setBusy(true); setErr('');
    try { const r = await api.saveDeal(ctx.shopId, { ...d, until: d.until || '' }); ctx.apply('deals', r); ctx.toast('המבצע נשמר ✓'); setD(blank); }
    catch (e) { setErr(errText(e)); }
    setBusy(false);
  }
  async function del(x) {
    if (!confirm(`למחוק את המבצע "${x.title}"?`)) return;
    try { await api.deleteDeal(ctx.shopId, x.id); ctx.apply('deals', { ...x, deleted_at: new Date().toISOString() }); ctx.toast('נמחק'); }
    catch (e) { ctx.toast(errText(e)); }
  }
  const which = !d.until ? 'none' : d.until === today() ? 'today' : d.until === untilPreset('week') ? 'week' : d.until === untilPreset('month') ? 'month' : '';
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>⭐ מבצעים</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <div className="muted small">כל עובד יכול להוסיף ולעדכן. מבצע נעלם לבד כשנגמר התאריך.</div>
      {list.length > 0 && <div className="card menu-list" style={{ marginTop: 10 }}>
        {list.map((x) => (
          <div key={x.id} className="mrow">
            <span className="e">⭐</span>
            <span className="grow"><b>{x.title}</b><div className="muted small">{untilLabel(x.until)}{x.until && x.until < today() ? ' (נגמר)' : ''} · {x.by_name} · {timeAgo(x.updated_at)}</div></span>
            <button className="btn sm" onClick={() => setD({ id: x.id, title: x.title, details: x.details, until: x.until || '' })}>✏️</button>
            <button className="btn sm danger" onClick={() => del(x)}>🗑️</button>
          </div>
        ))}
      </div>}
      <label className="lbl">{d.id ? 'עריכת מבצע' : '➕ מבצע חדש'}</label>
      <input className="input" value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="למשל: כיסוי + מגן מסך ב-₪79" />
      <input className="input" style={{ marginTop: 8 }} value={d.details} onChange={(e) => set('details', e.target.value)} placeholder="פרטים (לא חובה), למשל: במקום ₪120" />
      <label className="lbl">עד מתי?</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {PRESETS.map(([k, l]) => <button key={k} className={'chip' + (which === k ? ' on' : '')} onClick={() => set('until', k === 'none' ? '' : k === 'today' ? today() : untilPreset(k))}>{l}</button>)}
      </div>
      <input className="input" type="date" style={{ marginTop: 6 }} value={d.until || ''} onChange={(e) => set('until', e.target.value)} />
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary grow" disabled={busy} onClick={save}>{busy ? 'שומר…' : d.id ? 'שמירה' : 'הוספה'}</button>
        {d.id && <button className="btn" onClick={() => setD(blank)}>ביטול</button>}
      </div>
    </Sheet>
  );
}
