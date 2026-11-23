'use client';
// 📎 קבצים, סרטונים וקישורים בפריט מידע
import { useRef, useState } from 'react';
import { uploadFile, MAX_FILE, errText } from '@/lib/api';
import { fileKind, fmtSize, downloadHref, isOwnVideo, isApk, copyText, urlHref } from '@/lib/kb';

const isVideoUrl = (u) => /youtu\.?be|vimeo\.com|tiktok\.com|\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
const cleanName = (n) => String(n || '').replace(/\.[A-Za-z0-9]{1,8}$/, '').trim();

// ===== עריכה =====
export function FilesEdit({ files, onChange, setBusy, busy }) {
  const fileRef = useRef(null);
  const vidRef = useRef(null);
  const [link, setLink] = useState(null); // {url, name}
  const [err, setErr] = useState('');
  const list = files || [];

  async function pick(f, video) {
    if (!f) return;
    setErr('');
    if (f.size > MAX_FILE) { setErr(`הקובץ גדול מדי (${fmtSize(f.size)}). עד 50MB — לסרטון ארוך עדיף קישור (יוטיוב, דרייב).`); return; }
    setBusy(video ? 'video' : 'file');
    try {
      const r = await uploadFile(f, video);
      const isApkFile = /\.apk$/i.test(f.name);
      onChange([...list, { kind: video ? 'video' : 'file', url: r.url, name: isApkFile ? f.name : cleanName(f.name) || (video ? 'סרטון' : 'קובץ'), size: r.size, mime: r.mime }]);
    } catch (e) { setErr('ההעלאה נכשלה: ' + errText(e)); }
    setBusy('');
  }
  function addLink() {
    let u = link.url.trim();
    if (!u) { setLink(null); return; }
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    u = u.replace(/^http:/i, 'https:');
    if (!/^https:\/\/[^\s.]+\.[^\s]+$/.test(u)) { setErr('הקישור לא נראה תקין'); return; }
    onChange([...list, { kind: isVideoUrl(u) ? 'video' : 'link', url: u, name: link.name.trim() || (isVideoUrl(u) ? 'סרטון' : '') }]);
    setLink(null); setErr('');
  }
  const rename = (i, name) => onChange(list.map((x, n) => (n === i ? { ...x, name } : x)));

  return (
    <div className="files-ed">
      <div className="add3">
        <button type="button" className="btn" disabled={!!busy && busy !== 'ai'} onClick={() => fileRef.current?.click()}>
          {busy === 'file' ? <span className="spin sm" /> : <span>📱</span>}{busy === 'file' ? 'מעלה…' : 'אפליקציה / קובץ'}
        </button>
        <button type="button" className="btn" disabled={!!busy && busy !== 'ai'} onClick={() => vidRef.current?.click()}>
          {busy === 'video' ? <span className="spin sm" /> : <span>🎬</span>}{busy === 'video' ? 'מעלה סרטון…' : 'סרטון'}
        </button>
        <button type="button" className="btn" onClick={() => setLink(link ? null : { url: '', name: '' })}><span>🔗</span>קישור</button>
      </div>
      <input ref={fileRef} type="file" hidden onChange={(e) => { pick(e.target.files?.[0], false); e.target.value = ''; }} />
      <input ref={vidRef} type="file" accept="video/*" hidden onChange={(e) => { pick(e.target.files?.[0], true); e.target.value = ''; }} />
      {link && (
        <div className="card pad" style={{ marginTop: 8 }}>
          <input className="input" dir="ltr" inputMode="url" autoFocus placeholder="https://…  (אתר, יוטיוב, דרייב, חנות אפליקציות)" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
          <input className="input" style={{ marginTop: 6 }} placeholder="שם (לא חובה) — למשל: הסבר באתר שיאומי" value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }} />
          <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn primary sm" onClick={addLink}>הוספה</button><button type="button" className="btn sm" onClick={() => setLink(null)}>ביטול</button></div>
        </div>
      )}
      {list.map((x, i) => {
        const k = fileKind(x);
        return (
          <div key={x.url + i} className="card att">
            <span className={'ic ' + k.cls}>{k.e}</span>
            <span className="grow">
              <input className="att-name" value={x.name} placeholder={k.label} onChange={(e) => rename(i, e.target.value)} aria-label="שם" />
              <span className="muted small">{[k.label, fmtSize(x.size)].filter(Boolean).join(' · ')}{x.kind === 'link' || (x.kind === 'video' && !isOwnVideo(x.url)) ? <span className="ltr"> · {x.url.replace(/^https:\/\/(www\.)?/, '').slice(0, 40)}</span> : ' · הועלה ✓'}</span>
            </span>
            <button type="button" className="rm" aria-label="הסרה" onClick={() => onChange(list.filter((_, n) => n !== i))}>✕</button>
          </div>
        );
      })}
      {err && <div className="err">{err}</div>}
      <div className="muted small" style={{ marginTop: 6 }}>כל סוג קובץ: אפליקציה (APK), PDF, מסמך, סרטון — עד 50MB. אפשר לשנות את השם של כל קובץ.</div>
    </div>
  );
}

// ===== צפייה =====
export function FilesView({ it, ctx }) {
  const list = it.files || [];
  if (!list.length) return null;
  async function send(x) {
    const k = fileKind(x);
    const text = `${it.title ? it.title + '\n' : ''}${k.e} ${x.name || k.label}${isApk(x) ? ' (להורדה והתקנה)' : ''}:\n${x.kind === 'file' ? downloadHref(x) : x.url}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }
  return (
    <div className="files-view">
      {list.map((x, i) => {
        const k = fileKind(x);
        const href = x.kind === 'file' ? downloadHref(x) : urlHref(x.url);
        return (
          <div key={x.url + i} className="att-block">
            <div className="card att">
              <span className={'ic ' + k.cls}>{k.e}</span>
              <span className="grow"><b>{x.name || k.label}</b><span className="muted small">{[k.label, fmtSize(x.size)].filter(Boolean).join(' · ')}</span></span>
            </div>
            {x.kind === 'video' && isOwnVideo(x.url) && <video className="att-video" src={x.url} controls playsInline preload="metadata" />}
            <div className="row wrap-row" style={{ marginTop: 6 }}>
              {x.kind === 'file' && <a className="btn primary sm grow" href={href}>{isApk(x) ? '⬇️ הורדה והתקנה' : '⬇️ הורדה'}</a>}
              {x.kind === 'file' && /pdf|image/i.test(x.mime || '') && <a className="btn sm" href={x.url} target="_blank" rel="noreferrer">👁️ פתיחה</a>}
              {x.kind === 'video' && !isOwnVideo(x.url) && <a className="btn primary sm grow" href={href} target="_blank" rel="noreferrer">▶ צפייה בסרטון</a>}
              {x.kind === 'link' && <a className="btn primary sm grow" href={href} target="_blank" rel="noreferrer">פתיחה ↗</a>}
              <button className="btn sm" onClick={() => send(x)}>📤 שליחה</button>
              <button className="btn sm" onClick={() => copyText(x.kind === 'file' ? href : x.url).then(() => ctx.toast('הקישור הועתק'))}>📋 קישור</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
