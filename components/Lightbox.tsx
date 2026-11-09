'use client';

import { useEffect, useRef, useState } from 'react';

// תצוגת תמונות במסך מלא: החלקה בין תמונות, לחיצה להגדלה (זום) ותזוזה עם האצבע/העכבר, וסרטון מוצר.

export type MediaItem = { kind: 'image'; src: string } | { kind: 'video'; src: string };

// קישור יוטיוב (רגיל, קצר או shorts) לכתובת הטמעה; אחרת null
export function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0` : null;
}

export function VideoPlayer({ src, className = '' }: { src: string; className?: string }) {
  const yt = youtubeEmbed(src);
  if (yt) {
    return (
      <iframe
        src={yt}
        title="סרטון המוצר"
        className={`w-full aspect-video rounded-xl bg-black ${className}`}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return <video src={src} controls playsInline className={`w-full max-h-[80vh] rounded-xl bg-black ${className}`} />;
}

export default function Lightbox({
  items,
  index,
  onClose,
  onIndex,
  alt,
}: {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  alt: string;
}) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const touchX = useRef<number | null>(null);
  const item = items[index];
  const count = items.length;

  const go = (dir: number) => {
    setZoom(false);
    onIndex((index + dir + count) % count);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // בעברית: חץ שמאלה = הבא
      if (e.key === 'ArrowLeft') go(1);
      if (e.key === 'ArrowRight') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  if (!item) return null;

  const moveOrigin = (clientX: number, clientY: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setOrigin(`${((clientX - r.left) / r.width) * 100}% ${((clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col" dir="rtl" role="dialog" aria-modal="true" aria-label="תמונות המוצר">
      <div className="flex items-center justify-between p-3 text-white text-xs font-bold">
        <span>
          {index + 1} / {count}
        </span>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-lg cursor-pointer" aria-label="סגירה">
          ✕
        </button>
      </div>

      <div
        className="flex-1 relative flex items-center justify-center overflow-hidden px-2"
        onTouchStart={(e) => {
          if (!zoom) touchX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (zoom) moveOrigin(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget);
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {item.kind === 'image' ? (
          <img
            src={item.src}
            alt={alt}
            draggable={false}
            onClick={(e) => {
              moveOrigin(e.clientX, e.clientY, e.currentTarget);
              setZoom((z) => !z);
            }}
            onMouseMove={(e) => zoom && moveOrigin(e.clientX, e.clientY, e.currentTarget)}
            style={{ transform: zoom ? 'scale(2.2)' : 'scale(1)', transformOrigin: origin }}
            className={`max-h-full max-w-full object-contain select-none transition-transform duration-200 ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          />
        ) : (
          <div className="w-full max-w-3xl">
            <VideoPlayer src={item.src} />
          </div>
        )}

        {count > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl items-center justify-center cursor-pointer"
              aria-label="הקודם"
            >
              ›
            </button>
            <button
              onClick={() => go(1)}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl items-center justify-center cursor-pointer"
              aria-label="הבא"
            >
              ‹
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar p-3 justify-center">
          {items.map((m, i) => (
            <button
              key={i}
              onClick={() => {
                setZoom(false);
                onIndex(i);
              }}
              className={`w-14 h-14 shrink-0 rounded-lg overflow-hidden border-2 bg-white/5 cursor-pointer ${i === index ? 'border-orange-500' : 'border-transparent opacity-60'}`}
              aria-label={m.kind === 'video' ? 'סרטון' : `תמונה ${i + 1}`}
            >
              {m.kind === 'image' ? <img src={m.src} alt="" className="w-full h-full object-contain" /> : <span className="text-white text-xl">▶</span>}
            </button>
          ))}
        </div>
      )}
      <p className="text-center text-[11px] text-white/50 pb-3">{item.kind === 'image' ? 'לחיצה על התמונה להגדלה · החלקה למעבר' : ''}</p>
    </div>
  );
}
