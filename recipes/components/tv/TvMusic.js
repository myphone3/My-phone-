'use client';
// המוזיקה בטלוויזיה: "אי" קטן באמצע למעלה — וידאו קטן, שם השיר וכפתורי הקודם / עצירה / הבא.
// כשהשיר מתחלף האי נפתח לרגע ונסגר. כשהמוזיקה מנגנת בטלפון — במקום הווידאו מוצגת תמונת השיר.
import { useEffect, useRef, useState } from 'react';
import MusicPlayer from '@/components/MusicPlayer';
import { trackOf, setMusic } from '@/lib/music';
import { thumb } from '@/lib/youtube';

export default function TvMusic({ cast, cmdRef, started, duck, remoteInfo }) {
  const m = cast.state.music;
  const here = !!m && m.output === 'tv';
  const [localInfo, setLocalInfo] = useState(null);
  const info = here ? localInfo : remoteInfo;
  const track = trackOf(m);
  const vid = info?.videoId || track?.videoId;
  const title = info?.title || track?.title || 'מוזיקה';
  const playing = m?.playing !== false;

  // שיר חדש → האי נפתח ל-4 שניות
  const [big, setBig] = useState(false);
  const prev = useRef(title);
  useEffect(() => {
    if (prev.current === title) return;
    const was = prev.current;
    prev.current = title;
    if (!m || !was || was === 'מוזיקה') { setBig(false); return; }
    setBig(true);
    const t = setTimeout(() => setBig(false), 4000);
    return () => clearTimeout(t);
  }, [title]); // eslint-disable-line react-hooks/exhaustive-deps

  const cmd = (c) => (e) => { e.stopPropagation(); cmdRef.current?.(c); cast.send('musicCmd', { cmd: c }); };
  const toggle = (e) => { e.stopPropagation(); setMusic(cast.update, { playing: !playing }); };

  return (
    <div className={'tv-music' + (m ? '' : ' hidden') + (big ? ' big' : '') + (playing ? ' playing' : '')}>
      <div className="yt">
        <MusicPlayer music={m} active={here} update={cast.update} send={cast.send} cmdRef={cmdRef} duck={duck} width={192} height={108} onInfo={setLocalInfo} unlocked={started} />
        {!here && m && (vid ? <img src={thumb(vid)} alt="" /> : null)}
      </div>
      <div className="info">
        <b>{title}</b>
        {big && <small>{info?.author || (m?.listId ? m.listTitle : '')}{!here && m ? ' · מתנגן בטלפון' : ''}</small>}
      </div>
      <span className="eq" aria-hidden="true"><i /><i /><i /></span>
      <div className="mc">
        <button data-nav="" onClick={cmd('prev')} aria-label="השיר הקודם">⏮</button>
        <button data-nav="" onClick={toggle} aria-label={playing ? 'עצירה' : 'המשך'}>{playing ? '⏸' : '▶'}</button>
        <button data-nav="" onClick={cmd('next')} aria-label="השיר הבא">⏭</button>
      </div>
    </div>
  );
}
