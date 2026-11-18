'use client';
import { useEffect, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import InstallButton from '@/components/InstallButton';
import PushToggle from '@/components/PushToggle';
import { api, errText } from '@/lib/api';
import { signOut, userName } from '@/lib/auth';
import { setLastShop, clearCached } from '@/lib/cache';
import { KINDS, typeOf, timeAgo, FIELDS, ALL_FIELDS } from '@/lib/kb';

function TagsManager({ ctx, back }) {
  const [kind, setKind] = useState('company');
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const counts = useMemo(() => { const c = {}; for (const it of ctx.items) for (const t of it.tag_ids || []) c[t] = (c[t] || 0) + 1; return c; }, [ctx.items]);
  const list = ctx.tags.filter((t) => t.kind === kind && !t.deleted_at).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'he'));
  const companies = ctx.tags.filter((t) => t.kind === 'company' && !t.deleted_at);

  async function save() {
    try { const t = await api.saveTag(ctx.shopId, edit); ctx.applyTags([t]); setEdit(null); } catch (e) { setErr(errText(e)); }
  }
  async function del(t) {
    if (!confirm(`למחוק את "${t.name}"? הפריטים עצמם לא יימחקו.`)) return;
    try { await api.deleteTag(ctx.shopId, t.id); ctx.applyTags([{ ...t, deleted_at: new Date().toISOString() }]); setEdit(null); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <button className="btn sm" onClick={back}>→ חזרה</button>
      <div className="tabs">{KINDS.map((k) => <button key={k.k} className={'tab' + (kind === k.k ? ' on' : '')} onClick={() => { setKind(k.k); setEdit(null); }}>{k.label}</button>)}</div>
      {edit && (
        <div className="card pad" style={{ marginTop: 10 }}>
          <b>{edit.id ? 'עריכה' : 'חדש'}</b>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" style={{ width: 70, textAlign: 'center' }} placeholder="😀" value={edit.emoji || ''} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} />
            <input className="input grow" placeholder="שם" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
          </div>
          {kind === 'device' && (
            <select className="input" style={{ marginTop: 8 }} value={edit.parent_id || ''} onChange={(e) => setEdit({ ...edit, parent_id: e.target.value || null })}>
              <option value="">חברה: (לא משויך)</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary sm" onClick={save}>שמירה</button>
            <button className="btn sm" onClick={() => setEdit(null)}>ביטול</button>
            {edit.id && ctx.isAdmin && <button className="btn sm danger" onClick={() => del(edit)}>מחיקה</button>}
          </div>
        </div>
      )}
      {err && <div className="err">{err}</div>}
      <div className="card menu-list" style={{ marginTop: 10 }}>
        <button onClick={() => setEdit({ kind, name: '', emoji: '' })}><span className="e">➕</span><span className="grow">הוספה</span></button>
        {list.map((t) => (
          <button key={t.id} onClick={() => setEdit({ ...t })}>
            <span className="e">{t.emoji || KINDS.find((k) => k.k === kind).e}</span>
            <span className="grow">{t.name}{t.parent_id && ctx.tagsById[t.parent_id] && <span className="muted small"> · {ctx.tagsById[t.parent_id].name}</span>}</span>
            <span className="muted">{counts[t.id] || 0}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Trash({ ctx, back }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.deletedItems(ctx.shopId).then(setList).catch((e) => setErr(errText(e))); }, [ctx.shopId]);
  async function restore(it) {
    try { await api.restoreItem(ctx.shopId, it.id); setList((l) => l.filter((x) => x.id !== it.id)); ctx.applyItem({ ...it, deleted_at: null }); ctx.toast('שוחזר'); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <button className="btn sm" onClick={back}>→ חזרה</button>
      <div className="h2">🗑️ פריטים שנמחקו</div>
      {err && <div className="err">{err}</div>}
      {list === null && !err && <div className="spin" />}
      {list?.length === 0 && <div className="empty">אין פריטים שנמחקו</div>}
      {list?.map((it) => (
        <div key={it.id} className="card it">
          <div className="ic">{typeOf(it.type).e}</div>
          <div className="grow"><div className="t">{it.title}</div><div className="s">נמחק ע״י {it.updated_by_name} · {timeAgo(it.deleted_at)}</div></div>
          <button className="btn sm" onClick={() => restore(it)}>שחזור</button>
        </div>
      ))}
    </>
  );
}

function Misses({ ctx, back }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.misses(ctx.shopId).then(setList).catch((e) => setErr(errText(e))); }, [ctx.shopId]);
  async function set(m, status) {
    try { await api.missSet(ctx.shopId, m.id, status); setList((l) => l.filter((x) => x.id !== m.id)); ctx.refresh(); } catch (e) { setErr(errText(e)); }
  }
  return (
    <>
      <button className="btn sm" onClick={back}>→ חזרה</button>
      <div className="h2">🔍 חסר במאגר</div>
      <div className="muted small" style={{ marginBottom: 8 }}>דברים שעובדים חיפשו ולא מצאו. כדאי להוסיף אותם — ככה המאגר מתמלא במה שבאמת צריך.</div>
      {err && <div className="err">{err}</div>}
      {list === null && !err && <div className="spin" />}
      {list?.length === 0 && <div className="empty"><div className="e">🎉</div>אין כרגע חיפושים שלא נמצאו</div>}
      {list?.map((m) => (
        <div key={m.id} className="card it" style={{ alignItems: 'center' }}>
          <div className="ic">🔍</div>
          <div className="grow"><div className="t">{m.query}</div><div className="s">חיפשו {m.count} פעמים · אחרון: {m.last_by_name} {timeAgo(m.last_at)}</div></div>
          <button className="btn sm primary" onClick={() => { set(m, 'done'); ctx.replace({ t: 'edit', draft: { title: m.query } }); }}>➕ הוספה</button>
          <button className="btn sm" onClick={() => set(m, 'ignored')} aria-label="לא רלוונטי">✕</button>
        </div>
      ))}
    </>
  );
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function More({ ctx }) {
  const [view, setView] = useState('');
  const [name, setName] = useState(ctx.shop.name);
  const [err, setErr] = useState('');

  function exportCSV() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['כותרת', 'סוג', ...ALL_FIELDS.map((k) => FIELDS[k].label), 'פרטים', 'חברות', 'מכשירים', 'נושאים', 'נוסף ע"י', 'עודכן'];
    const rows = ctx.items.map((it) => {
      const tg = (k) => (it.tag_ids || []).map((t) => ctx.tagsById[t]).filter((t) => t?.kind === k).map((t) => t.name).join(', ');
      return [it.title, typeOf(it.type).label, ...ALL_FIELDS.map((k) => it.fields?.[k] || ''), it.body, tg('company'), tg('device'), tg('topic'), it.created_by_name, it.updated_at?.slice(0, 10)];
    });
    download(`מידע-${ctx.shop.name}.csv`, '﻿' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    download(`גיבוי-${ctx.shop.name}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ shop: ctx.shop.name, at: new Date().toISOString(), tags: ctx.tags, items: ctx.items }, null, 1), 'application/json');
  }
  async function rename() {
    try { await api.updateShop(ctx.shopId, name, null, false); ctx.refresh(); ctx.toast('נשמר'); } catch (e) { setErr(errText(e)); }
  }
  async function leave() {
    if (!confirm('לצאת מהחנות? כדי לחזור תצטרך קישור הצטרפות ואישור.')) return;
    try { await api.leave(ctx.shopId); clearCached(ctx.shopId); setLastShop(''); location.replace('/?all'); } catch (e) { setErr(errText(e)); }
  }

  return (
    <Sheet onClose={ctx.close}>
      <div className="sheet-head"><h2>☰ עוד</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      {view === 'tags' ? <TagsManager ctx={ctx} back={() => setView('')} /> : view === 'misses' ? <Misses ctx={ctx} back={() => setView('')} /> : view === 'trash' ? <Trash ctx={ctx} back={() => setView('')} /> : (
        <>
          <div className="muted small">מחובר בתור {userName(ctx.user)} · {ctx.items.length} פריטי מידע</div>
          <div className="card menu-list" style={{ marginTop: 10 }}>
            <button onClick={() => ctx.replace({ t: 'import' })}><span className="e">💬</span><span className="grow">ייבוא מוואטסאפ</span></button>
            <button onClick={() => ctx.replace({ t: 'board' })}><span className="e">📣</span><span className="grow">הודעות ומשימות</span>{ctx.unread > 0 && <span className="dot" style={{ position: 'static' }}>{ctx.unread}</span>}</button>
            <button onClick={() => ctx.replace({ t: 'ask' })}><span className="e">✨</span><span className="grow">שאל את המאגר</span></button>
            <button onClick={() => setView('misses')}><span className="e">🔍</span><span className="grow">חסר במאגר (חיפשו ולא מצאו)</span>{ctx.shop.misses > 0 && <span className="muted">{ctx.shop.misses}</span>}</button>
            <button onClick={() => ctx.replace({ t: 'scan', onPick: (n) => setTimeout(() => ctx.open({ t: 'edit', draft: { type: 'imei', fields: { imei: n } } }), 300) })}><span className="e">📷</span><span className="grow">סריקת IMEI</span></button>
            <button onClick={() => ctx.replace({ t: 'team' })}><span className="e">👥</span><span className="grow">עובדים</span>{ctx.shop.pending > 0 && <span className="dot" style={{ position: 'static' }}>{ctx.shop.pending}</span>}</button>
            <button onClick={() => setView('tags')}><span className="e">🏷️</span><span className="grow">חברות, מכשירים ונושאים</span></button>
            {ctx.isAdmin && <button onClick={() => setView('trash')}><span className="e">🗑️</span><span className="grow">פריטים שנמחקו</span></button>}
            <button onClick={exportCSV}><span className="e">📊</span><span className="grow">ייצוא לאקסל</span></button>
            <button onClick={exportJSON}><span className="e">💾</span><span className="grow">גיבוי מלא (קובץ)</span></button>
            <a href="/?all"><span className="e">🏪</span><span className="grow">החלפת חנות / חנות חדשה</span></a>
          </div>
          <PushToggle ctx={ctx} />
          <div style={{ marginTop: 12 }}><InstallButton /></div>
          <div className="card pad" style={{ marginTop: 12 }}>
            <b>💡 טיפ: שמירה ישר מוואטסאפ</b>
            <div className="muted small" style={{ marginTop: 4 }}>אחרי שמתקינים את האפליקציה: לוחצים לחיצה ארוכה על הודעה בוואטסאפ ← שיתוף ← "מידע". ההודעה נכנסת ומסתדרת לבד.</div>
          </div>
          {ctx.isAdmin && (
            <div className="card pad" style={{ marginTop: 12 }}>
              <b>שם החנות</b>
              <div className="row" style={{ marginTop: 8 }}>
                <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn" onClick={rename}>שמירה</button>
              </div>
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <div className="row wrap-row" style={{ marginTop: 14 }}>
            <button className="btn sm" onClick={() => signOut().then(() => { setLastShop(''); location.replace('/'); })}>התנתקות</button>
            {ctx.shop.role !== 'owner' && <button className="btn sm danger" onClick={leave}>יציאה מהחנות</button>}
          </div>
        </>
      )}
    </Sheet>
  );
}
