'use client';
// נגן יוטיוב קטן בפינה: רק המוזיקה מתנגנת, המתכון נשאר על המסך.
// (יוטיוב לא מאפשר לנגן בלי שהנגן נראה, לכן הוא מוצג כחלון קטן.)
import { useEffect, useRef, useState } from 'react';

let apiPromise;
function loadApi() {
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

export default function TvMusic({ music, send, cmdRef, started }) {
  const holder = useRef(null);
  const player = useRef(null);
  const loaded = useRef('');
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const [blocked, setBlocked] = useState(false);
  const key = music ? `${music.videoId || ''}|${music.listId || ''}` : '';

  // יצירת הנגן בפעם הראשונה שמבקשים מוזיקה
  useEffect(() => {
    if (!music || player.current) return;
    let dead = false;
    loadApi().then((YT) => {
      if (dead || player.current) return;
      const vars = { autoplay: 1, controls: 0, disablekb: 1, playsinline: 1, rel: 0, iv_load_policy: 3, fs: 0 };
      if (music.listId) { vars.listType = 'playlist'; vars.list = music.listId; }
      player.current = new YT.Player(holder.current, {
        width: '220', height: '124',
        videoId: music.videoId || undefined,
        playerVars: vars,
        events: {
          onReady: (e) => {
            loaded.current = key;
            e.target.setVolume(music.volume ?? 60);
            if (music.playing !== false) e.target.playVideo();
            setReady(true);
          },
          onStateChange: (e) => {
            const d = e.target.getVideoData?.() || {};
            if (d.title) { setTitle(d.title); send('musicInfo', { title: d.title, author: d.author || '' }); }
            if (e.data === 1) setBlocked(false);
          },
        },
      });
    });
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!music]);

  // החלפת שיר / פלייליסט, הפעלה / השהיה, עוצמה
  useEffect(() => {
    const p = player.current;
    if (!ready || !p) return;
    if (!music) { try { p.stopVideo(); } catch {} loaded.current = ''; return; }
    if (loaded.current !== key) {
      loaded.current = key;
      if (music.listId) p.loadPlaylist({ list: music.listId, listType: 'playlist', index: 0 });
      else p.loadVideoById(music.videoId);
    }
    p.setVolume(music.volume ?? 60);
    if (music.playing === false) p.pauseVideo(); else p.playVideo();
    // אם הדפדפן חוסם צליל עד לחיצה — מציגים הודעה
    const t = setTimeout(() => { try { if (music.playing !== false && p.getPlayerState() !== 1) setBlocked(true); } catch {} }, 3500);
    return () => clearTimeout(t);
  }, [ready, key, music?.playing, music?.volume, started]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cmdRef.current = (cmd) => {
      const p = player.current;
      if (!p) return;
      try {
        if (cmd === 'next') p.nextVideo();
        if (cmd === 'prev') p.previousVideo();
        if (cmd === 'play') p.playVideo();
      } catch {}
    };
  }, [cmdRef]);

  return (
    <div className={'tv-music' + (music ? '' : ' hidden')}>
      <div className="yt"><div ref={holder} /></div>
      <div className="info">
        <b>🎵 {title || music?.title || 'מוזיקה'}</b>
        <small>{blocked ? 'לחצו OK בשלט כדי להפעיל צליל' : music?.playing === false ? 'מושהה' : 'מתנגן ברקע'}</small>
      </div>
    </div>
  );
}
