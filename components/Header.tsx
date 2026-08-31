import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-white border-b py-4 px-6 flex items-center justify-between" dir="rtl">
      <Link href="/" className="flex items-center gap-3 cursor-pointer group">
        <img src="/logo.PNG" alt="NEW PHONE" className="w-10 h-10 object-contain rounded-full shadow-xs group-hover:scale-105 transition" />
        <div className="flex flex-col">
          <span className="font-black text-base text-gray-950 tracking-wider">NEW PHONE</span>
          <span className="text-[10px] text-gray-500 font-bold">הפלאפון החדש שלי</span>
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <Link 
          href="/cart" 
          className="flex items-center gap-1.5 bg-black text-white px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
        >
          <span>🛒</span>
          <span>עגלה</span>
        </Link>
      </div>
    </header>
  );
}
