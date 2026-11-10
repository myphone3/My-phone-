import Link from 'next/link';
import Icon from '@/components/Icon';
import { notFound } from 'next/navigation';
import { GUIDES, GUIDE_CATEGORIES, getGuide } from '@/lib/guides';
import { WhatsAppIcon } from '@/components/Logos';
import { BUSINESS } from '@/lib/business';
import GuideTable from '@/components/GuideTables';
import KosherExplainer from '@/components/KosherExplainer';
import { CertLogo } from '@/components/ProductExtras';

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
  // קודם מדריכים מאותו נושא, ואחר כך השאר
  const others = [...GUIDES.filter((x) => x.slug !== g.slug && x.category === g.category), ...GUIDES.filter((x) => x.category !== g.category)].slice(0, 3);
  const cat = GUIDE_CATEGORIES.find((c) => c.key === g.category);
  const headings = g.blocks.filter((b) => b.type === 'h').map((b) => (b as { text: string }).text);
  let hIndex = 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-16 space-y-6" dir="rtl">
      <nav className="text-xs font-bold text-gray-500 flex gap-2">
        <Link href="/" className="hover:text-orange-600">דף הבית</Link>
        <span className="text-gray-300">/</span>
        <Link href="/guide" className="hover:text-orange-600">מדריכים</Link>
        {cat && (
          <>
            <span className="text-gray-300">/</span>
            <Link href={`/guide#${cat.key}`} className="hover:text-orange-600">{cat.title}</Link>
          </>
        )}
      </nav>

      <article className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10 space-y-5">
        <header className="space-y-2">
          <span className="flex items-center gap-2">
            <span className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center"><Icon name={g.emoji} size={30} /></span>
            {g.cert && <CertLogo name={g.cert} size={56} className="border border-gray-100 p-1" />}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{g.title}</h1>
          <p className="text-sm text-gray-500">{g.excerpt}</p>
          <div className="flex gap-2 flex-wrap">
            {cat && <span className="text-[11px] font-bold bg-orange-50 text-orange-800 px-2 py-0.5 rounded-lg inline-flex items-center gap-1"><Icon name={cat.emoji} size={12} /> {cat.title}</span>}
            <span className="text-[11px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{g.minutes} דק׳ קריאה</span>
          </div>
        </header>

        {/* השורה התחתונה */}
        {g.keyPoints?.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-black text-green-900"><Icon name="check" size={14} /> בקצרה</span>
            {g.keyPoints.map((k) => (
              <p key={k} className="text-sm text-green-950 flex gap-2">
                <span className="text-green-600 font-black shrink-0">✓</span>
                <span>{k}</span>
              </p>
            ))}
          </div>
        )}

        {/* תוכן העניינים */}
        {headings.length >= 3 && (
          <nav className="bg-gray-50 rounded-2xl p-4 text-sm" aria-label="תוכן העניינים">
            <span className="flex items-center gap-1.5 text-xs font-black text-gray-700 mb-1.5"><Icon name="book" size={14} /> במדריך הזה</span>
            <ol className="space-y-1">
              {headings.map((h, i) => (
                <li key={h}>
                  <a href={`#s${i + 1}`} className="text-orange-700 hover:underline font-bold">
                    {i + 1}. {h.replace(/^\d+\.\s*/, '')}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="space-y-4 text-sm sm:text-base leading-8 text-gray-700">
          {g.blocks.map((b, i) => {
            switch (b.type) {
              case 'h': {
                hIndex += 1;
                return (
                  <h2 key={i} id={`s${hIndex}`} className="text-lg sm:text-xl font-black text-gray-900 pt-4 border-t border-gray-100 scroll-mt-28 flex items-center gap-2">
                    <span className="w-7 h-7 shrink-0 rounded-lg bg-orange-600 text-white text-sm flex items-center justify-center">{hIndex}</span>
                    <span>{b.text.replace(/^\d+\.\s*/, '')}</span>
                  </h2>
                );
              }
              case 'p':
                return <p key={i}>{b.text}</p>;
              case 'list':
                return (
                  <ul key={i} className="space-y-2 pr-1">
                    {b.items.map((it) => {
                      const [head, ...rest] = it.split(': ');
                      return (
                        <li key={it} className="flex gap-2 bg-gray-50/70 rounded-xl px-3 py-2">
                          <span className="text-orange-600 font-black shrink-0">•</span>
                          <span>{rest.length && head.length < 40 ? (<><b className="text-gray-900">{head}:</b> {rest.join(': ')}</>) : it}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              case 'tip':
                return (
                  <p key={i} className="bg-orange-50 border-r-4 border-orange-500 rounded-xl p-4 text-sm text-orange-950">
                    <span className="font-black">טיפ: </span>{b.text}
                  </p>
                );
              case 'table':
                return <GuideTable key={i} which={b.which} />;
              case 'kinds':
                return (
                  <div key={i} className="not-prose leading-normal">
                    <KosherExplainer compact />
                  </div>
                );
              case 'cta':
                return (
                  <Link key={i} href={b.href} className="block text-center bg-orange-600 hover:bg-orange-700 text-white py-3.5 rounded-2xl text-sm font-black transition">
                    {b.label} ←
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
          className="bg-[#25D366] text-white px-5 py-3 rounded-2xl text-sm font-black shrink-0 inline-flex items-center gap-2"
        >
          <WhatsAppIcon size={18} color="#fff" /> שאלה בוואטסאפ
        </a>
      </div>

      <section className="space-y-3">
        <h2 className="font-black text-gray-900">עוד מדריכים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {others.map((o) => (
            <Link key={o.slug} href={`/guide/${o.slug}`} className="bg-white border border-gray-100 hover:border-orange-300 rounded-2xl p-4 transition">
              <span className="text-orange-600"><Icon name={o.emoji} size={24} /></span>
              <span className="block text-sm font-black text-gray-900 mt-1 leading-snug">{o.title}</span>
              <span className="block text-[11px] text-gray-500 mt-1">{o.minutes} דק׳ קריאה</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
