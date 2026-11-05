'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ANNOUNCEMENTS } from '@/lib/storeInfo';

// פס הודעות רץ בראש האתר. אפשר לעצור אותו בכפתור; למי שביקש פחות תנועה הוא מוצג סטטי
export default function AnnouncementBar() {
  const pathname = usePathname();
  const [paused, setPaused] = useState(false);
  if (pathname?.startsWith('/admin')) return null;

  // ההודעות כפולות כדי למלא את רוחב המסך; קוראי מסך מקבלים כל הודעה פעם אחת
  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS];
  return (
    <div className="bg-gray-900 text-white text-xs font-bold flex items-center" dir="rtl" aria-label="הודעות החנות">
      <div className="flex-1 overflow-hidden motion-reduce:hidden">
        <div
          className="flex w-max animate-[marquee_28s_linear_infinite] hover:[animation-play-state:paused] py-2"
          style={paused ? { animationPlayState: 'paused' } : undefined}
        >
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0" aria-hidden={half === 1}>
              {items.map((text, i) => (
                <span key={i} className="px-6 whitespace-nowrap" aria-hidden={i >= ANNOUNCEMENTS.length || undefined}>
                  {text}
                  <span className="text-orange-400 pr-6">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* בלי אנימציה: כל ההודעות בשורות */}
      <div className="hidden motion-reduce:flex flex-1 flex-wrap justify-center gap-x-6 gap-y-1 py-2 px-4">
        {ANNOUNCEMENTS.map((text) => (
          <span key={text}>{text}</span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? 'הפעלת פס ההודעות' : 'עצירת פס ההודעות'}
        className="motion-reduce:hidden shrink-0 px-3 py-2 text-white/70 hover:text-white cursor-pointer"
      >
        {paused ? '▶' : '❚❚'}
      </button>
    </div>
  );
}
