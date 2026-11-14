'use client';
// משאיר את מסך הטלוויזיה דלוק: Wake Lock כשיש, ובנוסף "וידאו" שקט וזעיר שמתנגן בלולאה
// (טלוויזיות רבות לא נכבות / לא עוברות לשומר מסך כל עוד מתנגן וידאו)
import { useEffect } from 'react';

export function useKeepAwake(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let lock = null, video = null, stream = null, canvas = null, raf = null, dead = false;

    const getLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
          lock.addEventListener?.('release', () => { lock = null; });
        }
      } catch {}
    };

    const startVideo = () => {
      try {
        canvas = document.createElement('canvas');
        canvas.width = 2; canvas.height = 2;
        const ctx = canvas.getContext('2d');
        let t = 0;
        const draw = () => { if (dead) return; t++; ctx.fillStyle = t % 2 ? '#000' : '#010101'; ctx.fillRect(0, 0, 2, 2); raf = setTimeout(draw, 1000); };
        draw();
        stream = canvas.captureStream?.(1);
        if (!stream) return;
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.loop = true;
        video.srcObject = stream;
        Object.assign(video.style, { position: 'fixed', width: '2px', height: '2px', opacity: '0.01', bottom: '0', right: '0', pointerEvents: 'none', zIndex: '-1' });
        document.body.appendChild(video);
        video.play().catch(() => {});
      } catch {}
    };

    getLock();
    startVideo();
    const onVis = () => { if (document.visibilityState === 'visible') { if (!lock) getLock(); video?.play().catch(() => {}); } };
    document.addEventListener('visibilitychange', onVis);
    // אחרי לחיצה ראשונה בשלט (חלק מהדפדפנים דורשים)
    const onKey = () => { if (!lock) getLock(); video?.play().catch(() => {}); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onKey);
    const iv = setInterval(() => { if (!lock) getLock(); if (video?.paused) video.play().catch(() => {}); }, 60000);

    return () => {
      dead = true;
      clearInterval(iv); clearTimeout(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onKey);
      try { lock?.release(); } catch {}
      try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
      video?.remove();
    };
  }, [enabled]);
}
