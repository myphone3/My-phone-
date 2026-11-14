'use client';
import { useEffect, useRef, useState } from 'react';
import { parseYouTube, thumb } from '@/lib/youtube';
import { updateKitchen } from '@/lib/api';
import { deviceId } from '@/lib/local';
import { MOODS, playNow, addToQueue, setMusic, jumpTo, removeAt, trackOf, musicCmd } from '@/lib/music';
import { fmtClock } from '@/lib/recipe';
import { Sheet } from './ui';

export function useProgress(info, playing) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, [playing]);
  if (!info?.duration) return { cur: 0, dur: 0 };
  const cur = Math.min(info.duration, info.current + (info.state === 1 ? (Date.now() - info.at) / 1000 : 0));
  return { cur, dur: info.duration };
}

export function Controls({ cast, info, big }) {
  const m = cast.state.music;
  if (!m) return null;
  return (
    <div className="music-ctrl">
      <button className={'icon-btn' + (m.shuffle ? ' on' : '')} onClick={() => setMusic(cast.update, { shuffle: !m.shuffle })} aria-label="ערבוב" title="ערבוב">🔀</button>
      <button className="icon-btn" onClick={() => musicCmd(cast, 'prev')} aria-label="הקודם">⏮</button>
      <button className="icon-btn main" onClick={() => setMusic(cast.update, { playing: m.playing === false })} aria-label="נגן/השהה">{m.playing === false ? '▶' : '⏸'}</button>
      <button className="icon-btn" onClick={() => musicCmd(cast, 'next')} aria-label="הבא">⏭</button>
      <button className={'icon-btn' + (m.repeat !== 'off' ? ' on' : '')} onClick={() => setMusic(cast.update, { repeat: m.repeat === 'all' ? 'one' : m.repeat === 'one' ? 'off' : 'all' })} aria-label="חזרה" title="חזרה">
        {m.repeat === 'one' ? '🔂' : '🔁'}
      </button>
    </div>
  );
}

function Result({ r, onPlay, onQueue, onSave, saved }) {
  return (
    <div className="music-item">
      <button className="row grow" style={{ textAlign: 'start', minWidth: 0 }} onClick={onPlay}>
        <span className="mthumb">{thumb(r.videoId) ? <img src={thumb(r.videoId)} alt="" /> : <span>🎵</span>}{r.listId && <i>☰</i>}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <b className="mt">{r.title}</b>
          <small className="muted">{r.listId ? 'פלייליסט' : [r.author, r.duration].filter(Boolean).join(' · ')}</small>
        </span>
      </button>
      {!r.listId && onQueue && <button className="mini" onClick={onQueue} aria-label="הוספה לתור">＋</button>}
      {onSave && <button className="mini" onClick={onSave} aria-label="שמירה">{saved ? '★' : '☆'}</button>}
    </div>
  );
}

export default function MusicSheet({ cast, data, kitchenId, changed, say, onClose, info }) {
  const m = cast.state.music;
  const [tab, setTab] = useState(m ? 'now' : 'search');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState('');
  const saved = data?.kitchen?.music || [];
  const me = deviceId();
  const output = m?.output || (cast.tvOnline ? 'tv' : me);
  const { cur, dur } = useProgress(info, m?.playing !== false);
  const seekRef = useRef(null);
  const track = trackOf(m);

  const search = async (query = q, k = kind) => {
    if (!query.trim()) return;
    setQ(query);
    setLoading(true);
    try {
      const r = await fetch(`/api/yt-search?q=${encodeURIComponent(query)}&kind=${k}`);
      const j = await r.json();
      setResults(j.results || []);
      if (!j.results?.length) say(j.error || 'לא נמצאו תוצאות');
    } catch { say('החיפוש לא זמין כרגע'); }
    setLoading(false);
  };

  const play = (item) => { playNow(cast.update, item, output); say('▶ ' + (item.title || 'מתנגן').slice(0, 40)); };
  const queue = (item) => { addToQueue(cast.update, item, output); say('נוסף לתור'); };
  const isSaved = (r) => saved.some((s) => (r.listId ? s.listId === r.listId : s.videoId === r.videoId && !s.listId));
  const toggleSave = async (r) => {
    const next = isSaved(r) ? saved.filter((s) => !(r.listId ? s.listId === r.listId : s.videoId === r.videoId && !s.listId))
      : [{ videoId: r.videoId || null, listId: r.listId || null, title: r.title, author: r.author || '' }, ...saved].slice(0, 40);
    try { await updateKitchen(kitchenId, { music: next }); await changed(); } catch { say('לא נשמר'); }
  };
  const fromLink = async () => {
    const y = parseYouTube(link);
    if (!y) { say('זה לא נראה כמו קישור של יוטיוב'); return; }
    let title = '';
    try { title = (await (await fetch(`/api/yt-title?${y.videoId && !y.listId ? 'v=' + y.videoId : 'list=' + y.listId}`)).json()).title || ''; } catch {}
    const item = { ...y, title: title || (y.listId ? 'פלייליסט' : 'שיר מיוטיוב') };
    play(item);
    if (!isSaved(item)) toggleSave(item);
    setLink('');
    setTab('now');
  };
  const paste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t) setLink(t); } catch { say('הדביקו את הקישור בתיבה'); }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="row" style={{ marginBottom: 10 }}>
        <h3 className="grow" style={{ margin: 0 }}>🎵 מוזיקה</h3>
        <div className="seg" style={{ flex: 'none' }}>
          <button className={output === 'tv' ? 'on' : ''} disabled={!cast.tvOnline && output !== 'tv'} onClick={() => m ? setMusic(cast.update, { output: 'tv' }) : null}>📺 טלוויזיה</button>
          <button className={output === me ? 'on' : ''} onClick={() => m ? setMusic(cast.update, { output: me }) : null}>📱 כאן</button>
        </div>
      </div>
      {!m && !cast.tvOnline && <p className="muted small" style={{ margin: '0 0 10px' }}>הטלוויזיה לא מחוברת — המוזיקה תתנגן בטלפון. כשהטלוויזיה תתחבר אפשר להעביר אליה בלחיצה.</p>}

      <div className="tabs">
        {[['now', 'מתנגן עכשיו'], ['search', 'חיפוש'], ['saved', `שמורים${saved.length ? ` (${saved.length})` : ''}`], ['link', 'קישור']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'now' && (
        !m ? (
          <div className="empty" style={{ padding: '30px 10px' }}>
            <div className="e">🎶</div>
            <p className="muted">עוד לא בחרתם מוזיקה. נסו אחת מהאווירות:</p>
            <div className="chips" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {MOODS.slice(0, 6).map((x) => <button key={x.q} className="chip" onClick={() => { setTab('search'); setKind('playlist'); search(x.q, 'playlist'); }}>{x.label}</button>)}
            </div>
          </div>
        ) : (
          <>
            <div className="now">
              <div className="cover">{(info?.videoId || track?.videoId) ? <img src={thumb(info?.videoId || track?.videoId)} alt="" /> : '🎵'}</div>
              <b>{info?.title || track?.title || 'טוען...'}</b>
              <small className="muted">{info?.author || track?.author || ''}{m.listId ? ` · ${m.listTitle}` : ''}</small>
              <small className="muted">{output === 'tv' ? '📺 מתנגן בטלוויזיה' : output === me ? '📱 מתנגן בטלפון הזה' : '📱 מתנגן בטלפון אחר'}</small>
            </div>
            {dur > 0 && (
              <div className="seek">
                <span>{fmtClock(cur)}</span>
                <input ref={seekRef} type="range" min="0" max={Math.round(dur)} value={Math.round(cur)} onChange={(e) => musicCmd(cast, 'seek', +e.target.value)} />
                <span>{fmtClock(dur)}</span>
              </div>
            )}
            <Controls cast={cast} info={info} big />
            <div className="row" style={{ padding: '0 6px' }}>
              <button className="mini" onClick={() => setMusic(cast.update, { volume: Math.max(0, (m.volume ?? 60) - 10) })}>🔈</button>
              <input type="range" min="0" max="100" value={m.volume ?? 60} onChange={(e) => setMusic(cast.update, { volume: +e.target.value })} className="grow vol" />
              <button className="mini" onClick={() => setMusic(cast.update, { volume: Math.min(100, (m.volume ?? 60) + 10) })}>🔊</button>
            </div>
            <p className="muted small" style={{ textAlign: 'center', margin: '6px 0 0' }}>כשטיימר מצלצל, המוזיקה נחלשת לבד</p>

            {!m.listId && m.queue?.length > 1 && (
              <>
                <h2 className="h2" style={{ fontSize: 16 }}>בתור ({m.queue.length})</h2>
                {m.queue.map((t, i) => (
                  <div key={i + t.videoId} className={'music-item' + (i === (m.index || 0) ? ' on' : '')}>
                    <button className="row grow" style={{ textAlign: 'start', minWidth: 0 }} onClick={() => jumpTo(cast.update, i)}>
                      <span className="mthumb"><img src={thumb(t.videoId)} alt="" /></span>
                      <span className="grow" style={{ minWidth: 0 }}><b className="mt">{i === (m.index || 0) ? '▶ ' : ''}{t.title}</b><small className="muted">{t.author}</small></span>
                    </button>
                    <button className="mini" onClick={() => removeAt(cast.update, i)} aria-label="הסרה">✕</button>
                  </div>
                ))}
              </>
            )}
            <button className="btn danger block" style={{ marginTop: 14 }} onClick={() => cast.update({ music: null })}>⏹ כיבוי המוזיקה</button>
          </>
        )
      )}

      {tab === 'search' && (
        <>
          <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="שיר, זמר או סגנון..." enterKeyHint="search" />
            <button className="btn primary" type="submit">חיפוש</button>
          </form>
          <div className="chips" style={{ marginTop: 8 }}>
            {[['all', 'הכל'], ['video', 'שירים'], ['playlist', 'פלייליסטים']].map(([k, l]) => (
              <button key={k} className={'chip' + (kind === k ? ' on' : '')} onClick={() => { setKind(k); if (q) search(q, k); }}>{l}</button>
            ))}
          </div>
          {!results.length && !loading && (
            <>
              <p className="muted small" style={{ margin: '10px 2px 6px' }}>אווירה מוכנה בלחיצה:</p>
              <div className="moods">
                {MOODS.map((x) => <button key={x.q} onClick={() => { setKind('playlist'); search(x.q, 'playlist'); }}>{x.label}</button>)}
              </div>
            </>
          )}
          {loading && <div className="busy" style={{ padding: 30 }}><div className="spinner" /></div>}
          {!loading && results.map((r) => (
            <Result key={(r.listId || '') + r.videoId} r={r} saved={isSaved(r)} onPlay={() => { play(r); setTab('now'); }} onQueue={() => queue(r)} onSave={() => toggleSave(r)} />
          ))}
        </>
      )}

      {tab === 'saved' && (
        saved.length ? saved.map((s, i) => (
          <Result key={i} r={s} saved onPlay={() => { play(s); setTab('now'); }} onQueue={s.listId ? null : () => queue(s)} onSave={() => toggleSave(s)} />
        )) : <p className="muted" style={{ textAlign: 'center', padding: 30 }}>לחצו ☆ ליד שיר או פלייליסט כדי לשמור אותו כאן</p>
      )}

      {tab === 'link' && (
        <>
          <label className="f">קישור מיוטיוב (שיר או פלייליסט)</label>
          <div className="row">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/..." dir="ltr" />
            <button className="btn" onClick={paste}>הדבקה</button>
          </div>
          <button className="btn primary block" style={{ marginTop: 10 }} disabled={!link.trim()} onClick={fromLink}>▶ לנגן</button>
          <p className="muted small">ביוטיוב לוחצים ״שיתוף״ ← ״העתקת קישור״ וחוזרים לכאן. הקישור נשמר אוטומטית ב״שמורים״.</p>
        </>
      )}
    </Sheet>
  );
}
