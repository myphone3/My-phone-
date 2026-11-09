import Link from 'next/link';
import { GUIDES } from '@/lib/guides';

export const metadata = {
  title: 'מדריכים: כשר, תומך כשר והגרסאות | NEW PHONE',
  description: 'כל מה שצריך לדעת לפני שקונים: מה זה מכשיר כשר, מה זה תומך כשר, מה ההבדל בין הגרסאות ואיך בוחרים.',
};

export default function GuidesPage() {
  const [first, ...rest] = GUIDES;
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">📖 מדריכים</h1>
        <p className="text-sm text-gray-500">כל מה שצריך לדעת כדי לבחור את המכשיר הנכון, בלי לנחש</p>
      </div>

      <Link
        href={`/guide/${first.slug}`}
        className="block bg-gradient-to-l from-gray-950 to-orange-950 text-white rounded-3xl p-6 sm:p-8 hover:shadow-xl transition group"
      >
        <span className="text-4xl">{first.emoji}</span>
        <h2 className="text-xl sm:text-2xl font-black mt-3 group-hover:text-orange-300 transition">{first.title}</h2>
        <p className="text-sm text-gray-300 mt-2 max-w-2xl">{first.excerpt}</p>
        <span className="inline-block mt-4 bg-orange-600 px-4 py-2 rounded-xl text-xs font-black">לקריאה · {first.minutes} דק׳ ←</span>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rest.map((g) => (
          <Link key={g.slug} href={`/guide/${g.slug}`} className="bg-white border-2 border-orange-100 hover:border-orange-300 rounded-3xl p-5 space-y-2 transition group">
            <span className="text-3xl">{g.emoji}</span>
            <h2 className="font-black text-gray-900 group-hover:text-orange-700 transition leading-snug">{g.title}</h2>
            <p className="text-xs text-gray-500 leading-relaxed">{g.excerpt}</p>
            <span className="block text-[11px] font-bold text-orange-700 pt-1">{g.minutes} דק׳ קריאה ←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
