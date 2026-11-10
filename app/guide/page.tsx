import Link from 'next/link';
import Icon from '@/components/Icon';
import { GUIDES, GUIDE_CATEGORIES, guidesIn } from '@/lib/guides';

export const metadata = {
  title: 'מדריכים: כשר, תומך כשר והגרסאות | NEW PHONE',
  description: 'כל מה שצריך לדעת לפני שקונים: מה זה מכשיר כשר, מה זה תומך כשר, מה ההבדל בין הגרסאות ואיך בוחרים.',
};

export default function GuidesPage() {
  const featured = GUIDES.find((g) => g.slug === 'kosher-vs-supported') || GUIDES[0];
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" dir="rtl">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">מדריכים</h1>
        <p className="text-sm text-gray-500">הסברים קצרים וברורים, כדי לבחור את המכשיר הנכון בלי לנחש</p>
      </div>

      {/* קפיצה לנושא */}
      <nav className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4" aria-label="נושאים">
        {GUIDE_CATEGORIES.map((c) => (
          <a key={c.key} href={`#${c.key}`} className="shrink-0 bg-white border border-gray-200 hover:border-orange-300 px-3 py-1.5 rounded-full text-xs font-bold text-gray-700 inline-flex items-center gap-1.5">
            <Icon name={c.emoji} size={14} className="text-orange-600" /> {c.title}
          </a>
        ))}
      </nav>

      {/* המדריך המומלץ */}
      <Link
        href={`/guide/${featured.slug}`}
        className="block bg-gradient-to-l from-gray-950 to-orange-950 text-white rounded-3xl p-6 sm:p-8 hover:shadow-xl transition group"
      >
        <span className="text-[11px] font-black bg-white/10 px-2 py-1 rounded-lg inline-flex items-center gap-1"><Icon name="star" size={12} /> הכי נקרא</span>
        <h2 className="text-xl sm:text-2xl font-black mt-3 group-hover:text-orange-300 transition">
          {featured.title}
        </h2>
        <p className="text-sm text-gray-300 mt-2 max-w-2xl">{featured.excerpt}</p>
        <span className="inline-block mt-4 bg-orange-600 px-4 py-2 rounded-xl text-xs font-black">לקריאה · {featured.minutes} דק׳ ←</span>
      </Link>

      {GUIDE_CATEGORIES.map((c) => {
        const list = guidesIn(c.key).filter((g) => g.slug !== featured.slug);
        if (!list.length) return null;
        return (
          <section key={c.key} id={c.key} className="space-y-3 scroll-mt-28">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Icon name={c.emoji} size={20} className="text-orange-600" /> {c.title}
              </h2>
              <p className="text-xs text-gray-500 pr-4 mt-0.5">{c.hint}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {list.map((g) => (
                <Link key={g.slug} href={`/guide/${g.slug}`} className="flex gap-4 bg-white border border-gray-100 hover:border-orange-300 hover:shadow-sm rounded-2xl p-4 transition group">
                  <span className="w-12 h-12 shrink-0 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><Icon name={g.emoji} size={24} /></span>
                  <span className="min-w-0 space-y-1">
                    <span className="block font-black text-gray-900 group-hover:text-orange-700 transition leading-snug">{g.title}</span>
                    <span className="block text-xs text-gray-500 leading-relaxed line-clamp-2">{g.excerpt}</span>
                    <span className="block text-[11px] font-bold text-orange-700">{g.minutes} דק׳ קריאה ←</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <Link href="/quiz" className="flex items-center justify-between gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4 hover:border-sky-400 transition">
        <span className="text-sm">
          <b className="text-gray-900 flex items-center gap-1.5"><Icon name="compass" size={16} className="text-sky-700" /> מעדיפים שנמליץ לכם?</b>
          <span className="text-xs text-gray-600">כמה שאלות קצרות, והמכשיר והגרסה המדויקים</span>
        </span>
        <span className="text-sky-700 font-black">←</span>
      </Link>
    </div>
  );
}
