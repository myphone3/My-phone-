import Link from 'next/link';
import type { Metadata } from 'next';
import { BUSINESS as B } from '@/lib/business';
import Icon from '@/components/Icon';
import TrustBadges from '@/components/TrustBadges';

export const metadata: Metadata = {
  title: 'אודות | NEW PHONE',
  description: 'NEW PHONE: חנות אונליין למכשירים כשרים, תומכי כשר, סמארטפונים, נגנים ואביזרים, עם משלוח עד הבית ושירות אישי בוואטסאפ.',
};

const VALUES = [
  { icon: 'shield', title: 'רק מה שבאמת מתאים', text: 'אנחנו מסבירים בפשטות מה ההבדל בין כשר, תומך כשר וסמארטפון, כדי שתבחרו בדיוק את מה שנכון לכם ולבית.' },
  { icon: 'chat', title: 'שירות אישי ואנושי', text: 'יש שאלה לפני הקנייה או אחריה? כותבים לנו בוואטסאפ ומקבלים מענה מאדם אמיתי, בלי מוקדים ובלי המתנה.' },
  { icon: 'truck', title: 'עד הבית', text: `מזמינים באתר בכמה דקות, והמשלוח מגיע עד הבית ${B.shippingDays}.` },
  { icon: 'box', title: 'מבחר במקום אחד', text: 'מכשירים כשרים, תומכי כשר, סמארטפונים, נגנים, אוזניות, מטענים ואביזרים, מהמותגים המובילים.' },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12" dir="rtl">
      <section className="text-center space-y-4">
        <img src="/logo-160.jpg" alt="NEW PHONE" width={96} height={96} className="w-24 h-24 mx-auto object-contain" />
        <h1 className="text-2xl sm:text-4xl font-black text-gray-900">הפלאפון החדש שלך</h1>
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-2xl mx-auto">
          NEW PHONE היא חנות אונליין למכשירים כשרים, תומכי כשר, סמארטפונים ונגנים. המטרה שלנו פשוטה: שכל אחד ימצא את
          המכשיר שמתאים לו, יבין בדיוק מה הוא קונה, ויקבל אותו עד הבית עם שירות אישי.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        {VALUES.map((v) => (
          <div key={v.title} className="bg-white border-2 border-orange-100 rounded-3xl p-5 space-y-2">
            <span className="w-11 h-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Icon name={v.icon} size={22} />
            </span>
            <h2 className="font-black text-gray-900">{v.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{v.text}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-black text-gray-900 text-center">קונים בראש שקט</h2>
        <TrustBadges />
      </section>

      <section className="bg-orange-50 border border-orange-200 rounded-3xl p-6 text-center space-y-3">
        <h2 className="text-lg font-black text-gray-900">נשמח לעזור</h2>
        <p className="text-sm text-gray-600">לא בטוחים איזה מכשיר לבחור? דברו איתנו או נסו את השאלון הקצר.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={`https://wa.me/${B.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-600 hover:bg-green-700 text-white font-black text-sm px-5 py-2.5 rounded-2xl transition"
          >
            כתבו לנו בוואטסאפ
          </a>
          <Link href="/quiz" className="bg-white border-2 border-orange-300 text-orange-700 font-black text-sm px-5 py-2.5 rounded-2xl transition hover:bg-orange-100">
            איזה מכשיר מתאים לי?
          </Link>
        </div>
        <p className="text-xs text-gray-500">
          טלפון: <span dir="ltr">{B.phone}</span> · מייל: {B.email}
        </p>
      </section>
    </div>
  );
}
