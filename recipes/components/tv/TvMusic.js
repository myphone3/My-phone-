'use client';
// כרטיס המוזיקה בפינת הטלוויזיה. כשהמוזיקה מנגנת בטלוויזיה — הנגן עצמו כאן (חלון קטן);
// כשהיא מנגנת בטלפון — מוצג רק מה מתנגן.
import { useState } from 'react';
import MusicPlayer from '@/components/MusicPlayer';
import { trackOf } from '@/lib/music';
import { thumb } from '@/lib/youtube';
import { fmtClock } from '@/lib/recipe';
import { useProgress } from '@/components/phone/MusicSheet';

export default function TvMusic({ cast, cmdRef, started, duck, remoteInfo }) {
  const m = cast.state.music;
  const here = !!m && m.output === 'tv';
  const [localInfo, setLocalInfo] = useState(null);
  const info = here ? localInfo : remoteInfo;
  const { cur, dur } = useProgress(info, m?.playing !== false);
  const track = trackOf(m);
  const next = m && !m.listId && m.queue?.length > 1 ? m.queue[((m.index || 0) + 1) % m.queue.length] : null;
  const vid = info?.videoId || track?.videoId;

  return (
    <div className={'tv-music' + (m ? '' : ' hidden')}>
      <div className="yt">
        <MusicPlayer music={m} active={here} update={cast.update} send={cast.send} cmdRef={cmdRef} duck={duck} width={256} height={144} onInfo={setLocalInfo} unlocked={started} />
        {!here && m && (vid ? <img src={thumb(vid)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null)}
      </div>
      <div className="info">
        <b>{m?.playing === false ? '⏸' : '🎵'} {info?.title || track?.title || 'מוזיקה'}</b>
        <small>{info?.author || (m?.listId ? m.listTitle : '')}{!here && m ? ' · מתנגן בטלפון' : ''}</small>
        {dur > 0 && (
          <div className="tv-prog"><i style={{ width: `${(cur / dur) * 100}%` }} /><span>{fmtClock(cur)} / {fmtClock(dur)}</span></div>
        )}
        {next && <small className="nx">הבא: {next.title}</small>}
      </div>
    </div>
  );
}
