'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Page from '@/components/Page';
import Sheet from '@/components/Sheet';
import { api, errText, uploadPhoto } from '@/lib/api';
import { shrink } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import { norm, copyText, timeAgo } from '@/lib/kb';
import { PHONES, SAMVIX, PHONE_KINDS, SV_KINDS, BRAND_ORDER } from '@/lib/devices';

// 🔑 מקש לגירסה (כל הפלאפונים הכשרים ותומכי הכשר) ו-🎵 גרסאות סמוויקס (הוראות + סרטון הסברה לכל מכשיר)
// הנתונים: kb_dev בשרת (ctx.devs), הרשימה: lib/devices.js + דגמים חדשים מהאתר (ctx.sitePhones) + מכשירים שנוספו ידנית

export const devKey = (list, id) => list + ':' + id;
const svKind = (k) => SV_KINDS.find((x) => x[0] === k) || ['', '🎵', ''];
const MAX_VIDEO = 50 * 1024 * 1024;

// כל המכשירים של רשימה, עם מה ששמור עליהם
export function devicesOf(ctx, list) {
  const base = list === 'keys' ? PHONES : SAMVIX;
  const ids = new Set(base.map((d) => d.id));
  const extra = list === 'keys' ? (ctx.sitePhones || []).filter((d) => d?.id && !ids.has(d.id)) : [];
  extra.forEach((d) => ids.add(d.id));
  const custom = [];
  for (const r of ctx.devs.values()) {
    if (r.list !== list || !r.custom || ids.has(r.dev_id)) continue;
    custom.push({ id: r.dev_id, name: r.custom.name, brand: r.custom.brand || 'נוספו ידנית', kind: r.custom.kind || (list === 'keys' ? 'kosher' : 'player'), img: '', mine: true });
  }
  return [...base, ...extra, ...custom].map((d) => {
    const info = ctx.devs.get(devKey(list, d.id)) || null;
    return { ...d, list, info, pic: info?.photo || d.img };
  });
}

function Pic({ d, size }) {
  const [bad, setBad] = useState(false);
  if (d.pic && !bad) return <img className="dv-pic" style={size ? { width: size, height: size } : null} src={d.pic} alt="" loading="lazy" onError={() => setBad(true)} />;
  return <span className="dv-pic none" style={size ? { width: size, height: size } : null}>{d.list === 'keys' ? '📱' : svKind(d.kind)[1]}</span>;
}

function useQuery() {
  const [q, setQ] = useState('');
  return [q, setQ, norm(q)];
}

// ===== 🔑 מקש לגירסה =====
export function KeysPage({ ctx }) {
  const [kind, setKind] = useState('kosher');
  const [q, setQ, nq] = useQuery();
  useEffect(() => { ctx.loadDevs(); }, []); // eslint-disable-line
  const all = useMemo(() => devicesOf(ctx, 'keys'), [ctx.devs, ctx.sitePhones]); // eslint-disable-line
  const mine = all.filter((d) => d.kind === kind);
  const done = mine.filter((d) => d.info?.key).length;
  const list = nq ? all.filter((d) => norm(d.name + ' ' + d.brand).includes(nq)) : mine;
  const groups = {};
  for (const d of list) (groups[d.brand || 'אחר'] = groups[d.brand || 'אחר'] || []).push(d);
  const rank = (b) => { const i = BRAND_ORDER.indexOf(b); return i < 0 ? 99 : i; };
  const order = Object.keys(groups).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'he'));
  return (
    <Page onBack={ctx.close} title="🔑 מקש לגירסה">
      <div className="seg">
        {PHONE_KINDS.map(([k, l]) => <button key={k} className={kind === k && !nq ? 'on' : ''} onClick={() => { setKind(k); setQ(''); }}>{l} · {all.filter((d) => d.kind === k).length}</button>)}
      </div>
      {!nq && <div className="dv-prog"><span>מולאו {done} מתוך {mine.length}</span><span className="dv-bar"><i style={{ width: Math.round(done / Math.max(1, mine.length) * 100) + '%' }} /></span></div>}
      <div className="search" style={{ marginTop: 10 }}>
        <span>🔎</span>
        <input className="input" type="search" placeholder="חיפוש דגם…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button onClick={() => setQ('')} aria-label="נקה">✕</button>}
      </div>
      {!list.length && <div className="empty">לא נמצא "{q}"</div>}
      {order.map((b) => (
        <div key={b}>
          <div className="h2">{b} · {groups[b].length}</div>
          <div className="list">
            {groups[b].map((d) => (
              <button key={d.id} className="card dv-row" onClick={() => ctx.open({ t: 'dev', list: 'keys', id: d.id })}>
                <Pic d={d} />
                <span className="grow" style={{ minWidth: 0 }}>
                  <b>{d.name}</b>
                  {nq && <span className={'pill ' + (d.kind === 'kosher' ? 'p-blue' : 'p-violet')} style={{ marginInlineStart: 6 }}>{d.kind === 'kosher' ? 'כשר' : 'תומך כשר'}</span>}
                  {d.info?.note && <div className="muted small dv-note">{d.info.note}</div>}
                </span>
                <span className={'dv-key' + (d.info?.key ? ' has' : '')}>{d.info?.key || '+ מקש'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <button className="btn dashed block" style={{ marginTop: 16 }} onClick={() => ctx.open({ t: 'dev-add', list: 'keys', kind })}>➕ מכשיר שלא ברשימה</button>
      <div className="muted small center" style={{ marginTop: 10 }}>הרשימה מגיעה מהאתר של כשר פון. דגם חדש שעולה לאתר מופיע כאן לבד.</div>
    </Page>
  );
}

// ===== 🎵 גרסאות סמוויקס =====
export function SamvixPage({ ctx }) {
  const [kind, setKind] = useState('all');
  const [q, setQ, nq] = useQuery();
  useEffect(() => { ctx.loadDevs(); }, []); // eslint-disable-line
  const all = useMemo(() => devicesOf(ctx, 'samvix'), [ctx.devs]); // eslint-disable-line
  const list = all.filter((d) => (kind === 'all' || d.kind === kind) && (!nq || norm(d.name).includes(nq)));
  const cur = list.filter((d) => !d.old);
  const old = list.filter((d) => d.old);
  const kinds = kind === 'all' ? SV_KINDS.map((x) => x[0]) : [kind];
  const filled = all.filter((d) => d.info?.body || d.info?.video).length;
  const tile = (d) => (
    <button key={d.id} className="card dv-tile" onClick={() => ctx.open({ t: 'dev', list: 'samvix', id: d.id })}>
      <Pic d={d} />
      <b>{d.name}</b>
      <span className="dv-marks">
        {d.info?.body && <span className="pill p-in">📝 הוראות</span>}
        {d.info?.video && <span className="pill p-in">🎬 סרטון</span>}
        {!d.pic && <span className="muted small">📷 אין תמונה</span>}
      </span>
    </button>
  );
  return (
    <Page onBack={ctx.close} title="🎵 גרסאות סמוויקס" sub={filled ? `${filled} מכשירים עם הוראות או סרטון` : null}>
      <div className="chips">
        <button className={'chip' + (kind === 'all' ? ' on' : '')} onClick={() => setKind('all')}>הכול <span className="n">{all.length}</span></button>
        {SV_KINDS.map(([k, e, l]) => {
          const n = all.filter((d) => d.kind === k).length;
          return n ? <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{e} {l} <span className="n">{n}</span></button> : null;
        })}
      </div>
      <div className="search" style={{ marginTop: 8 }}>
        <span>🔎</span>
        <input className="input" type="search" placeholder="חיפוש דגם…" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button onClick={() => setQ('')} aria-label="נקה">✕</button>}
      </div>
      {!list.length && <div className="empty">לא נמצא "{q}"</div>}
      {kinds.map((k) => {
        const g = cur.filter((d) => d.kind === k);
        if (!g.length) return null;
        const [, e, l] = svKind(k);
        return <div key={k}><div className="h2">{e} {l} · {g.length}</div><div className="dv-grid">{g.map(tile)}</div></div>;
      })}
      {old.length > 0 && (
        <details className="dv-old">
          <summary className="h2">🗄️ דגמים ישנים (לא נמכרים כבר) · {old.length}</summary>
          <div className="dv-grid">{old.map(tile)}</div>
        </details>
      )}
      <button className="btn dashed block" style={{ marginTop: 16 }} onClick={() => ctx.open({ t: 'dev-add', list: 'samvix', kind: kind === 'all' ? 'player' : kind })}>➕ מכשיר סמוויקס שלא ברשימה</button>
    </Page>
  );
}

function isFileVideo(u) { return /\/kb-videos\/|\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(u || ''); }

// ===== מכשיר אחד: מקש / הוראות + סרטון + תמונה =====
export function DeviceSheet({ ctx, list, id }) {
  const d = devicesOf(ctx, list).find((x) => x.id === id);
  const info = d?.info || {};
  const [key, setKey] = useState(info.key || '');
  const [note, setNote] = useState(info.note || '');
  const [body, setBody] = useState(info.body || '');
  const [video, setVideo] = useState(info.video || '');
  const [photo, setPhoto] = useState(info.photo || '');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const keyRef = useRef(null);
  const vRef = useRef(null);
  const pRef = useRef(null);
  if (!d) return null;
  const pic = photo || d.img;

  async function pickPhoto(f) {
    if (!f) return;
    setBusy('photo'); setErr('');
    try { setPhoto(await uploadPhoto(await shrink(f, 900, '#fff'))); }
    catch (e) { setErr('התמונה לא עלתה: ' + errText(e)); }
    setBusy('');
  }
  async function pickVideo(f) {
    if (!f) return;
    if (f.size > MAX_VIDEO) { setErr(`הסרטון גדול מדי (${Math.round(f.size / 1048576)}MB, עד 50MB). אפשר לקצר אותו, או להעלות ליוטיוב ולהדביק קישור.`); return; }
    setBusy('video'); setErr('');
    try {
      const ext = (f.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
      const path = `${ctx.shopId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('kb-videos').upload(path, f, { contentType: f.type || 'video/mp4', cacheControl: '31536000' });
      if (error) throw error;
      setVideo(supabase.storage.from('kb-videos').getPublicUrl(path).data.publicUrl);
    } catch (e) { setErr('הסרטון לא עלה: ' + errText(e)); }
    setBusy('');
  }
  async function save() {
    let v = video.trim();
    if (v && !/^https:\/\//.test(v)) v = 'https://' + v.replace(/^http:\/\//, '');
    setBusy('save'); setErr('');
    try {
      const r = await api.devSave(ctx.shopId, list, d.id, { key: key.trim(), note: note.trim(), body: body.trim(), video: v, photo, custom: d.mine ? { name: d.name, kind: d.kind, brand: d.brand } : null });
      ctx.applyDev(r);
      ctx.toast(list === 'keys' ? (key.trim() ? `✓ נשמר מקש ל-${d.name}` : 'נשמר ✓') : `✓ נשמר ל-${d.name}`);
      ctx.close();
    } catch (e) { setErr(errText(e)); setBusy(''); }
  }
  async function remove() {
    if (!confirm(`למחוק את "${d.name}" מהרשימה?`)) return;
    try { await api.devDelete(ctx.shopId, list, d.id); ctx.removeDev(list, d.id); ctx.toast('נמחק'); ctx.close(); }
    catch (e) { setErr(errText(e)); }
  }
  const type = (c) => { setKey((k) => k + c); keyRef.current?.focus(); };

  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>{list === 'keys' ? '🔑' : svKind(d.kind)[1]} {d.name}</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <div className="dv-head">
        <button className="dv-photo" onClick={() => pRef.current?.click()} disabled={!!busy} aria-label="תמונה">
          {pic ? <img src={pic} alt="" /> : <span>📷<br />תמונה</span>}
          {busy === 'photo' && <span className="dv-busy">מעלה…</span>}
        </button>
        <input ref={pRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        <div className="grow" style={{ minWidth: 0 }}>
          {list === 'keys'
            ? <><span className={'pill ' + (d.kind === 'kosher' ? 'p-blue' : 'p-violet')}>{d.kind === 'kosher' ? 'כשר' : 'תומך כשר'}</span> <span className="muted small">{d.brand}</span></>
            : <><span className="pill p-gray">{svKind(d.kind)[1]} {svKind(d.kind)[2]}</span>{d.old && <span className="pill p-low" style={{ marginInlineStart: 4 }}>דגם ישן</span>}</>}
          <div className="muted small" style={{ marginTop: 6 }}>{pic ? 'לחיצה על התמונה = החלפה' : 'אין תמונה, אפשר לצלם את המכשיר'}</div>
        </div>
      </div>

      {list === 'keys' ? (
        <>
          <label className="lbl">המקש לגירסה</label>
          <div className="row">
            <input ref={keyRef} className="input dv-keyin grow" value={key} onChange={(e) => setKey(e.target.value)} placeholder="למשל *#1234#" autoComplete="off" dir="ltr" />
            {info.key && <button className="btn" onClick={() => copyText(info.key).then(() => ctx.toast('הועתק'))}>העתקה</button>}
          </div>
          <div className="dv-pad">
            {['*', '#', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((c) => <button key={c} className="btn sm" onClick={() => type(c)}>{c}</button>)}
            <button className="btn sm" onClick={() => setKey((k) => k.slice(0, -1))} aria-label="מחיקה">⌫</button>
          </div>
          <label className="lbl">הערה (לא חובה)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="למשל: רק מגרסה 2.1 ומעלה" />
        </>
      ) : (
        <>
          <label className="lbl">📝 הוראות</label>
          <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="למשל: איך מעדכנים גרסה, איך מכניסים שירים, איך מאפסים…" />
          <label className="lbl">🎬 סרטון הסברה</label>
          {video ? (
            <div className="dv-video">
              {isFileVideo(video) ? <video src={video} controls playsInline preload="metadata" /> : <a className="btn soft block" href={video} target="_blank" rel="noreferrer">▶ צפייה בסרטון</a>}
              <button className="btn sm danger" onClick={() => setVideo('')}>הסרת הסרטון</button>
            </div>
          ) : (
            <>
              <button className="btn soft block" disabled={!!busy} onClick={() => vRef.current?.click()}>{busy === 'video' ? 'מעלה סרטון… (זה לוקח קצת)' : '📹 העלאה מהטלפון (עד 50MB)'}</button>
              <input ref={vRef} type="file" accept="video/*" hidden onChange={(e) => pickVideo(e.target.files?.[0])} />
              <input className="input" style={{ marginTop: 8 }} dir="ltr" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="או קישור (יוטיוב, דרייב…)" />
            </>
          )}
        </>
      )}
      {info.updated_name && <div className="muted small" style={{ marginTop: 10 }}>עודכן ע״י {info.updated_name} · {timeAgo(info.updated_at)}</div>}
      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary grow" disabled={!!busy} onClick={save}>{busy === 'save' ? 'שומר…' : 'שמירה'}</button>
        {d.mine && <button className="btn danger" disabled={!!busy} onClick={remove}>🗑️</button>}
      </div>
    </Sheet>
  );
}

// ===== מכשיר שלא ברשימה =====
export function AddDeviceSheet({ ctx, list, kind: kind0 }) {
  const kinds = list === 'keys' ? PHONE_KINDS : SV_KINDS.map(([k, e, l]) => [k, e + ' ' + l]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState(kinds.some((k) => k[0] === kind0) ? kind0 : kinds[0][0]);
  const [brand, setBrand] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    const n = name.trim();
    if (!n) { setErr('מה שם הדגם?'); return; }
    if (devicesOf(ctx, list).some((d) => norm(d.name) === norm(n))) { setErr(`"${n}" כבר ברשימה. אפשר לחפש אותו.`); return; }
    setBusy(true); setErr('');
    try {
      const id = 'c-' + crypto.randomUUID().slice(0, 12);
      const r = await api.devSave(ctx.shopId, list, id, { custom: { name: n, kind, brand: list === 'keys' ? brand.trim() : 'סמוויקס' } });
      ctx.applyDev(r);
      ctx.toast('✓ נוסף');
      ctx.replace({ t: 'dev', list, id });
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }
  return (
    <Sheet onClose={() => !busy && ctx.close()}>
      <div className="sheet-head"><h2>➕ {list === 'keys' ? 'פלאפון' : 'מכשיר סמוויקס'} חדש</h2><button className="icon-btn" onClick={ctx.close} aria-label="סגירה">✕</button></div>
      <label className="lbl">שם הדגם</label>
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={list === 'keys' ? 'למשל: Q9' : 'למשל: iKosher G5'} autoFocus />
      {list === 'keys' && <><label className="lbl">חברה (לא חובה)</label><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="למשל: קיוליקס" /></>}
      <label className="lbl">סוג</label>
      <div className="chips wrapped" style={{ paddingTop: 0 }}>
        {kinds.map(([k, l]) => <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      {err && <div className="err">{err}</div>}
      <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={save}>{busy ? 'מוסיף…' : 'הוספה'}</button>
      <div className="muted small center" style={{ marginTop: 8 }}>בשלב הבא אפשר להוסיף תמונה{list === 'keys' ? ' ומקש' : ', הוראות וסרטון'}.</div>
    </Sheet>
  );
}

// תוצאות בחיפוש הראשי
export function searchDevices(ctx, w) {
  if (!w || w.length < 2) return [];
  const hit = (d) => norm(d.name + ' ' + (d.brand || '')).includes(w);
  const has = (d) => !!(d.info?.key || d.info?.note || d.info?.body || d.info?.video);
  const all = [...devicesOf(ctx, 'keys'), ...devicesOf(ctx, 'samvix')].filter(hit);
  return [...all.filter(has), ...all.filter((d) => !has(d))].slice(0, 6);
}
