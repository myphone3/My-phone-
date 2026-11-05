'use client';

import { usePathname } from 'next/navigation';
import { ANNOUNCEMENTS } from '@/lib/storeInfo';

// פס הודעות רץ בראש האתר
export default function AnnouncementBar() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS];
  return (
    <div className="bg-gray-900 text-white text-xs font-bold overflow-hidden" dir="rtl" aria-label="הודעות החנות">
      <div className="flex w-max animate-[marquee_28s_linear_infinite] hover:[animation-play-state:paused] py-2">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0" aria-hidden={half === 1}>
            {items.map((text, i) => (
              <span key={i} className="px-6 whitespace-nowrap">
                {text}
                <span className="text-orange-400 pr-6">•</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
