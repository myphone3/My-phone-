'use client';
import { useState } from 'react';
import { parseYouTube, thumb } from '@/lib/youtube';
import { updateKitchen } from '@/lib/api';
import { Sheet } from './ui';

export default function MusicSheet({ cast, data, kitchenId, changed, say, onClose, info, openSheet }) {
  const [link, setLink] = useState('');
  const [adding, setAdding] = useState(false);
  const saved = data?.kitchen?.music || [];
  const m = cast.state.music;

  const play = (item) => cast.update({ music: { videoId: item.videoId || null, listId: item.listId || null, title: item.title || '', playing: true, volume: m?.volume ?? 60 } });
  const setM = (patch) => m && cast.update({ music: { ...m, ...patch } });

  const add = async () => {
    const y = parseYouTube(link);
    if (!y) { say('זה לא נראה כמו קישור של יוטיוב'); return; }
    setAdding(true);
    let title = '';
    try {
      const r = await fetch(`/api/yt-title?${y.videoId ? 'v=' + y.videoId : 'list=' + y.listId}`);
      title = (await r.json()).title || '';
    } catch {}
    const item = { ...y, title: title || (y.listId ? 'פלייליסט' : 'שיר מיוטיוב') };
    play(item);
    const next = [item, ...saved.filter((s) => !(s.videoId === y.videoId && s.listId === y.listId))].slice(0, 20);
    try { await updateKitchen(kitchenId, { music: next }); await changed(); } catch {}
    setLink('');
    setAdding(false);
  };
  const removeSaved = async (item) => {
    try { await updateKitchen(kitchenId, { music: saved.filter((s) => s !== item) }); await changed(); } catch {}
  };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setLink(t); } catch { say('הדביקו את הקישור בתיבה'); }
  };

  return (
    <Sheet onClose={onClose}>
      <h3>🎵 מוזיקה ברקע</h3>
      {!cast.tvOnline && (
        <div className="tip" style={{ background: 'var(--accent-soft)' }}>
          המוזיקה מתנגנת בטלוויזיה. <button style={{ textDecoration: 'underline', fontWeight: 700 }} onClick={() => openSheet('tv')}>חיבור לטלוויזיה</button>
        </div>
      )}

      {m && (
        <div className="box" style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 700 }}>{info?.title || m.title || 'מתנגן'}</div>
          <div className="music-ctrl">
            {m.listId && <button className="icon-btn" onClick={() => cast.send('musicCmd', { cmd: 'prev' })} aria-label="הקודם">⏮</button>}
            <button className="icon-btn main" onClick={() => setM({ playing: !m.playing })} aria-label="נגן/השהה">{m.playing ? '⏸' : '▶'}</button>
            {m.listId && <button className="icon-btn" onClick={() => cast.send('musicCmd', { cmd: 'next' })} aria-label="הבא">⏭</button>}
          </div>
          <div className="row">
            <span>🔈</span>
            <input type="range" min="0" max="100" value={m.volume ?? 60} onChange={(e) => setM({ volume: +e.target.value })} style={{ padding: 0, border: 0, background: 'none' }} />
            <span>🔊</span>
          </div>
          <button className="btn danger" style={{ marginTop: 10 }} onClick={() => cast.update({ music: null })}>כיבוי המוזיקה</button>
        </div>
      )}

      <label className="f">קישור מיוטיוב (שיר או פלייליסט)</label>
      <div className="row">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/..." dir="ltr" />
        <button className="btn" onClick={paste}>הדבקה</button>
      </div>
      <button className="btn primary block" style={{ marginTop: 10 }} disabled={!link.trim() || adding} onClick={add}>{adding ? 'רגע...' : '▶ לנגן בטלוויזיה'}</button>
      <p className="muted small">ביוטיוב לוחצים ״שיתוף״ ← ״העתקת קישור״, וחוזרים לכאן. רק המוזיקה תישמע — על המסך נשאר המתכון, עם חלון קטן בפינה.</p>
      <a className="btn block" href="https://www.youtube.com/results?search_query=%D7%9E%D7%95%D7%96%D7%99%D7%A7%D7%94+%D7%A8%D7%92%D7%95%D7%A2%D7%94+%D7%9C%D7%91%D7%99%D7%A9%D7%95%D7%9C" target="_blank" rel="noreferrer">🔎 חיפוש מוזיקה ביוטיוב</a>

      {saved.length > 0 && (
        <>
          <h2 className="h2" style={{ fontSize: 16 }}>שמורים</h2>
          {saved.map((s, i) => {
            const on = m && m.videoId === s.videoId && m.listId === s.listId;
            return (
              <div key={i} className={'music-item' + (on ? ' on' : '')}>
                <button className="row grow" style={{ textAlign: 'start' }} onClick={() => play(s)}>
                  {thumb(s.videoId) ? <img src={thumb(s.videoId)} alt="" /> : <span style={{ width: 64, textAlign: 'center', fontSize: 24 }}>📃</span>}
                  <span className="grow" style={{ fontWeight: 600, fontSize: 14 }}>{s.title}{s.listId ? ' · פלייליסט' : ''}</span>
                </button>
                <button className="icon-btn" style={{ width: 36, height: 36, fontSize: 14 }} onClick={() => removeSaved(s)} aria-label="הסרה">✕</button>
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
