'use client';

import Link from 'next/link';
import WelcomeTooltip from '@/components/WelcomeTooltip';

export default function Header() {
  return (
    <header className="w-full bg-white border-b py-3 px-4 sm:px-6 flex items-center justify-between relative z-40" dir="rtl">
      {/* לוגו האתר */}
      <Link href="/" className="flex items-center gap-3 cursor-pointer group shrink-0">
        <img src="/logo.PNG" alt="NEW PHONE" className="w-10 h-10 object-contain rounded-full shadow-xs group-hover:scale-105 transition" />
        <div className="flex flex-col">
          <span className="font-black text-base text-gray-950 tracking-wider">NEW PHONE</span>
          <span className="text-[10px] text-gray-500 font-bold">הפלאפון החדש שלי</span>
        </div>
      </Link>

      {/* אזור שמאל: כפתור התחברות והתראות גוגל (WelcomeTooltip) + עגלת קניות */}
      <div className="flex items-center gap-3">
        {/* כפתור גוגל האינטראקטיבי המלא עם ההתראות והחלונית הנפתחת */}
        <WelcomeTooltip />

        {/* כפתור עגלה */}
        <Link 
          href="/cart" 
          className="flex items-center gap-1.5 bg-black hover:bg-gray-800 text-white px-3.5 py-2 rounded-xl text-sm font-bold transition shadow-xs"
        >
          <span>🛒</span>
          <span>עגלה</span>
        </Link>
      </div>
    </header>
  );
}
