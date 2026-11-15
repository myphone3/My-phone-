'use client';
import { useEffect, useRef, useState } from 'react';
import MusicPlayer from '@/components/MusicPlayer';
import { deviceId } from '@/lib/local';
import { setMusic, trackOf, musicCmd } from '@/lib/music';
import { thumb } from '@/lib/youtube';
import { useProgress } from './MusicSheet';

// פס מוזיקה קבוע בתחתית הטלפון. כשבוחרים לנגן בטלפון — הנגן עצמו נמצא כאן ולא נעלם במעבר בין מסכים.
export default function MiniPlayer({ cast, info, setInfo, openMusic, duck, hidden }) {
  const m = cast.state.music;
  const me = deviceId();
  const here = !!m && m.output === me;
  const cmd = useRef(() => {});
  const [unlocked, setUnlocked] = useState(0);
  const { cur, dur } = useProgress(info, m?.playing !== false);

  useEffect(() => {
    const h = (e) => cmd.current(e.detail?.cmd, e.detail?.arg);
    window.addEventListener('rc-music', h);
    const remote = (e) => cmd.current(e.detail?.cmd, e.detail?.arg);
    window.addEventListener('rc-music-remote', remote);
    return () => { window.removeEventListener('rc-music', h); window.removeEventListener('rc-music-remote', remote); };
  }, []);

  useEffect(() => { document.body.classList.toggle('has-music', !!m && !hidden); }, [m, hidden]);

  const track = trackOf(m);
  const vid = info?.videoId || track?.videoId;
  return (
    <div className={'mini-player' + (m && !hidden ? '' : ' off')} onPointerDown={() => setUnlocked((x) => x + 1)}>
      {dur > 0 && <i className="mp-prog" style={{ width: `${(cur / dur) * 100}%` }} />}
      <div className="mp-media" onClick={openMusic}>
        <MusicPlayer music={m} active={here} update={cast.update} send={cast.send} cmdRef={cmd} duck={duck} width={112} height={63} onInfo={setInfo} unlocked={unlocked} />
        {!here && (vid ? <img src={thumb(vid)} alt="" /> : <span>🎵</span>)}
      </div>
      <button className="mp-text" onClick={openMusic}>
        <b>{info?.title || track?.title || 'מוזיקה'}</b>
        <small>{m?.output === 'tv' ? '📺 בטלוויזיה' : here ? '📱 בטלפון' : '📱 טלפון אחר'}</small>
      </button>
      {m && (
        <>
          <button className="mp-btn" onClick={() => musicCmd(cast, 'prev')} aria-label="הקודם">⏮</button>
          <button className="mp-btn main" onClick={() => setMusic(cast.update, { playing: m.playing === false })} aria-label="נגן/השהה">{m.playing === false ? '▶' : '⏸'}</button>
          <button className="mp-btn" onClick={() => musicCmd(cast, 'next')} aria-label="הבא">⏭</button>
        </>
      )}
    </div>
  );
}
