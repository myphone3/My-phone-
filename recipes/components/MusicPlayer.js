'use client';
// נגן יוטיוב שמנגן על המכשיר שנבחר (טלוויזיה או טלפון). יוטיוב לא מאפשר נגן מוסתר,
// לכן הוא מוצג כחלון וידאו קטן — וכל השאר על המסך נשאר המתכון.
import { useEffect, useRef, useState } from 'react';
import { trackKey, trackOf, nextIndex } from '@/lib/music';

let apiPromise;
function loadApi() {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise = apiPromise || new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiPromise;
}

export default function MusicPlayer({ music, active, update, send, cmdRef, duck, width = 256, height = 144, onInfo, unlocked }) {
  const holder = useRef(null);
  const player = useRef(null);
  const loaded = useRef('');
  const mRef = useRef(music);
  mRef.current = music;
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const key = active ? trackKey(music) : '';

  const report = () => {
    const p = player.current;
    if (!p?.getVideoData) return;
    try {
      const d = p.getVideoData() || {};
      const info = { title: d.title || '', author: d.author || '', videoId: d.video_id || '', current: p.getCurrentTime?.() || 0, duration: p.getDuration?.() || 0, state: p.getPlayerState?.(), at: Date.now() };
      onInfo?.(info);
      send?.('musicInfo', info);
    } catch {}
  };

  const advance = (dir) => {
    const m = mRef.current;
    const p = player.current;
    if (!m || !p) return;
    if (m.listId) { try { dir > 0 ? p.nextVideo() : p.previousVideo(); } catch {} return; }
    const i = nextIndex(m, dir);
    if (i === null) { update((s) => ({ music: s.music ? { ...s.music, playing: false } : null })); return; }
    update((s) => (s.music ? { music: { ...s.music, index: i, playing: true, rev: (s.music.rev || 0) + 1 } } : {}));
  };

  // יצירת הנגן
  useEffect(() => {
    if (!active || player.current) return;
    let dead = false;
    loadApi().then((YT) => {
      if (dead || player.current || !holder.current) return;
      player.current = new YT.Player(holder.current, {
        width: String(width), height: String(height),
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3, fs: 0 },
        events: {
          onReady: () => setReady(true),
          onStateChange: (e) => {
            if (e.data === 1) setBlocked(false);
            if (e.data === 0) {
              const m = mRef.current;
              if (m?.repeat === 'one') { try { e.target.seekTo(0); e.target.playVideo(); } catch {} }
              else if (!m?.listId) advance(1);
            }
            report();
          },
          onError: () => setTimeout(() => advance(1), 1200),
        },
      });
    }).catch(() => {});
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // החלפת שיר / פלייליסט
  useEffect(() => {
    const p = player.current;
    if (!ready || !p) return;
    if (!active || !music) { try { p.stopVideo(); } catch {} loaded.current = ''; return; }
    if (loaded.current === key) return;
    loaded.current = key;
    try {
      if (music.listId) {
        p.loadPlaylist({ list: music.listId, listType: 'playlist', index: 0 });
        p.setShuffle?.(!!music.shuffle);
        p.setLoop?.(music.repeat !== 'off');
      } else {
        const t = trackOf(music);
        if (t?.videoId) p.loadVideoById(t.videoId);
      }
    } catch {}
  }, [ready, key, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // הפעלה / השהיה / עוצמה / הנמכה כשטיימר מצלצל
  useEffect(() => {
    const p = player.current;
    if (!ready || !p || !active || !music) return;
    try {
      p.setVolume(Math.round((music.volume ?? 60) * (duck ? 0.25 : 1)));
      if (music.playing === false) p.pauseVideo(); else p.playVideo();
      if (music.listId) { p.setShuffle?.(!!music.shuffle); p.setLoop?.(music.repeat !== 'off'); }
    } catch {}
    const t = setTimeout(() => { try { if (music.playing !== false && ![1, 3].includes(p.getPlayerState())) setBlocked(true); } catch {} }, 4000);
    return () => clearTimeout(t);
  }, [ready, active, key, music?.playing, music?.volume, music?.shuffle, music?.repeat, duck, unlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // דיווח התקדמות לטלפון
  useEffect(() => {
    if (!ready || !active || !music) return;
    const iv = setInterval(report, 2500);
    return () => clearInterval(iv);
  }, [ready, active, !!music]); // eslint-disable-line react-hooks/exhaustive-deps

  // פקודות: הבא, הקודם, קפיצה בזמן
  useEffect(() => {
    if (!cmdRef) return;
    cmdRef.current = (cmd, arg) => {
      const p = player.current;
      if (!p || !active) return;
      try {
        if (cmd === 'next') advance(1);
        if (cmd === 'prev') { if ((p.getCurrentTime?.() || 0) > 5) p.seekTo(0, true); else advance(-1); }
        if (cmd === 'seek') { p.seekTo(Math.max(0, +arg || 0), true); setTimeout(report, 400); }
        if (cmd === 'fwd') p.seekTo((p.getCurrentTime() || 0) + (+arg || 15), true);
        if (cmd === 'play' && mRef.current?.playing !== false) p.playVideo();
      } catch {}
    };
  });

  return (
    <div className="yt-wrap" style={{ width, height, display: active && music ? 'block' : 'none' }}>
      <div ref={holder} />
      {blocked && active && music?.playing !== false && <div className="yt-blocked">לחצו כאן / OK להפעלת הצליל</div>}
    </div>
  );
}
