import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide } from '@/lib/guides';
import { BUSINESS } from '@/lib/business';
import GuideTable from '@/components/GuideTables';

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const g = getGuide(params.slug);
  if (!g) return { title: 'המדריך לא נמצא | NEW PHONE' };
  return { title: `${g.title} | NEW PHONE`, description: g.excerpt };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = getGuide(params.slug);
  if (!g) notFound();
  const others = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-16 space-y-6" dir="rtl">
      <nav className="text-xs font-bold text-gray-500 flex gap-2">
        <Link href="/" className="hover:text-orange-600">דף הבית</Link>
        <span className="text-gray-300">/</span>
        <Link href="/guide" className="hover:text-orange-600">מדריכים</Link>
      </nav>

      <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10 space-y-5">
        <header className="space-y-2">
          <span className="text-5xl">{g.emoji}</span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{g.title}</h1>
          <p className="text-sm text-gray-500">{g.excerpt}</p>
          <span className="inline-block text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{g.minutes} דק׳ קריאה</span>
        </header>

        <div className="space-y-4 text-sm sm:text-base leading-8 text-gray-700">
          {g.blocks.map((b, i) => {
            switch (b.type) {
              case 'h':
                return (
                  <h2 key={i} className="text-lg sm:text-xl font-black text-gray-900 pt-2">
                    {b.text}
                  </h2>
                );
              case 'p':
                return <p key={i}>{b.text}</p>;
              case 'list':
                return (
                  <ul key={i} className="space-y-1.5 pr-1">
                    {b.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span className="text-orange-600 font-black shrink-0">•</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                );
              case 'tip':
                return (
                  <p key={i} className="bg-orange-50 border-r-4 border-orange-500 rounded-xl p-4 text-sm text-orange-950">
                    💡 {b.text}
                  </p>
                );
              case 'table':
                return <GuideTable key={i} which={b.which} />;
              case 'cta':
                return (
                  <Link key={i} href={b.href} className="block text-center bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black transition">
                    {b.label}
                  </Link>
                );
            }
          })}
        </div>
      </article>

      <div className="bg-[#25D366]/10 border border-[#25D366]/40 rounded-3xl p-5 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="text-center sm:text-right">
          <p className="font-black text-gray-900">עדיין מתלבטים?</p>
          <p className="text-xs text-gray-600">ספרו לנו מה אתם צריכים, ונמליץ על המכשיר והגרסה המדויקים</p>
        </div>
        <a
          href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(`שלום, קראתי את המדריך "${g.title}" ויש לי שאלה`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#25D366] text-white px-5 py-3 rounded-2xl text-sm font-black shrink-0"
        >
          💬 שאלה בוואטסאפ
        </a>
      </div>

      <section className="space-y-3">
        <h2 className="font-black text-gray-900">עוד מדריכים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {others.map((o) => (
            <Link key={o.slug} href={`/guide/${o.slug}`} className="bg-white border border-orange-100 hover:border-orange-300 rounded-2xl p-4 transition">
              <span className="text-2xl">{o.emoji}</span>
              <span className="block text-sm font-black text-gray-900 mt-1 leading-snug">{o.title}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
