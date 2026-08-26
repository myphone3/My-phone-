import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-white border-b py-4 px-6 flex items-center justify-between" dir="rtl">
      <Link href="/" className="font-bold text-xl text-gray-900">
        החנות שלי
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
