import Link from 'next/link';
import Icon from '@/components/Icon';
import { GUIDES } from '@/lib/guides';
import KosherExplainer, { PHONE_CERT } from '@/components/KosherExplainer';
import GuideTable from '@/components/GuideTables';
import GuideMark from '@/components/GuideMark';
import { CertLogo } from '@/components/ProductExtras';
import { WhatsAppIcon } from '@/components/Logos';
import { BUSINESS } from '@/lib/business';

export const metadata = {
  title: 'המדריך: בוחרים מכשיר כשר צעד אחרי צעד | NEW PHONE',
  description: 'מדריך אחד, פשוט וברור: מכשיר כשר או תומך כשר, איזו גרסה לבחור, ונגני MP3 כשרים.',
};

// דף מודרך אחד: במקום רשימה ארוכה של מדריכים, הלקוח עובר צעד אחרי צעד
const STEPS = [
  { id: 'start', title: 'מה אתם מחפשים?' },
  { id: 'kosher', title: 'כשר או תומך כשר?' },
  { id: 'versions', title: 'בוחרים גרסה' },
  { id: 'players', title: 'נגני MP3' },
];

function Step({ n, id, title, hint, children }: { n: number; id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 bg-white border-2 border-orange-100 rounded-3xl p-5 sm:p-7 space-y-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 shrink-0 rounded-2xl bg-orange-600 text-white text-lg font-black flex items-center justify-center">{n}</span>
        <div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">{title}</h2>
          {hint && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Choice({ href, icon, title, text }: { href: string; icon: string; title: string; text: string }) {
  return (
    <a href={href} className="flex items-center gap-3 bg-orange-50/60 border-2 border-orange-100 hover:border-orange-400 rounded-2xl p-4 transition group">
      <span className="w-12 h-12 shrink-0 rounded-xl bg-white text-orange-600 flex items-center justify-center"><Icon name={icon} size={26} /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-black text-gray-900 group-hover:text-orange-700">{title}</span>
        <span className="block text-xs text-gray-500">{text}</span>
      </span>
      <span className="text-orange-600 font-black">↓</span>
    </a>
  );
}

export default function GuidesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-16 space-y-6" dir="rtl">
      <header className="text-center space-y-3">
        <div className="flex justify-center">
          <CertLogo name={PHONE_CERT} size={64} className="border border-gray-100 p-1 shadow-sm" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">בוחרים מכשיר כשר, צעד אחרי צעד</h1>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">כל מה שצריך לדעת במקום אחד, בלי מילים מסובכות. עוברים על הצעדים, ובסוף יודעים בדיוק מה מתאים לכם.</p>
      </header>

      {/* מפת הצעדים */}
      <nav className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:justify-center" aria-label="הצעדים במדריך">
        {STEPS.map((s, i) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 bg-white border-2 border-orange-200 hover:border-orange-400 pl-3 pr-1.5 py-1 rounded-full text-xs font-bold text-gray-700 inline-flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-orange-600 text-white text-[11px] font-black flex items-center justify-center">{i + 1}</span>
            {s.title}
          </a>
        ))}
      </nav>

      <Step n={1} id="start" title="מה אתם מחפשים?" hint="בוחרים, ועוברים ישר לצעד המתאים">
        <div className="grid sm:grid-cols-2 gap-3">
          <Choice href="#kosher" icon="phone" title="טלפון" text="מכשיר כשר או תומך כשר" />
          <Choice href="#players" icon="headphones" title="נגן MP3" text="לשירים, שיעורים וסיפורים" />
        </div>
      </Step>

      <Step n={2} id="kosher" title="טלפון: כשר או תומך כשר?" hint="ההבדל הוא במה שאפשר לעשות עם המכשיר. גוללים כדי לראות את שניהם.">
        <KosherExplainer compact />
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
          <p className="font-black text-gray-900">איך מחליטים?</p>
          <p className="flex gap-2"><span className="text-orange-600 font-black">←</span><span><b>רק לדבר בטלפון</b>, בכשרות המחמירה ביותר: <b className="text-orange-700">מכשיר כשר</b>. סיימתם!</span></p>
          <p className="flex gap-2"><span className="text-sky-700 font-black">←</span><span><b>צריכים גם הודעות, מצלמה, שירים או וואטסאפ</b>: <b className="text-sky-800">תומך כשר</b>. ממשיכים לצעד 3.</span></p>
        </div>
        <Link href="/guide/kosher-vs-supported" className="inline-block text-xs font-black text-orange-700 underline underline-offset-4">להסבר המלא: כשר או תומך כשר ←</Link>
      </Step>

      <Step n={3} id="versions" title="תומך כשר: בוחרים גרסה" hint="אותו מכשיר מגיע בכמה גרסאות. הגרסה קובעת מה פתוח ומה חסום.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            ['רק שירים ושיעורים', 'נגן גלריה'],
            ['רוצים גם לצלם', 'נגן מצלמה'],
            ['צריכים גם לשלוח הודעות', 'גרסה עם SMS'],
            ['צריכים וואטסאפ, ניווט או מוביט', 'כשר פליי'],
          ].map(([need, version]) => (
            <div key={need} className="flex items-center justify-between gap-2 bg-sky-50/70 border border-sky-100 rounded-xl px-3 py-2.5">
              <span className="text-gray-700">{need}</span>
              <span className="font-black text-sky-800 whitespace-nowrap">{version} ←</span>
            </div>
          ))}
        </div>
        <GuideTable which="versions" />
        <p className="text-[11px] text-gray-500">באף גרסה אין דפדפן, גוגל או יוטיוב.</p>
        <Link href={'/category/' + encodeURIComponent('תומך כשר')} className="block text-center bg-sky-700 hover:bg-sky-800 text-white py-3 rounded-2xl text-sm font-black transition">
          למכשירים התומכי כשר ←
        </Link>
      </Step>

      <Step n={4} id="players" title="נגני MP3 כשרים" hint="נגן קטן בלי אינטרנט. מעבירים את הקבצים מהמחשב.">
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {['נפח: כמה שירים ושיעורים ייכנסו', 'רמקול מובנה, או אוזניות בלבד', 'רדיו FM והקלטה (בחלק מהדגמים)', 'סוללה: כמה שעות השמעה בטעינה'].map((t) => (
            <li key={t} className="flex gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
              <Icon name="check" size={16} className="text-green-600 shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <Link href={'/category/' + encodeURIComponent('נגנים')} className="block text-center bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-2xl text-sm font-black transition">
          לכל נגני ה-MP3 ←
        </Link>
      </Step>

      {/* עדיין מתלבטים */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/quiz" className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-2xl p-4 hover:border-sky-400 transition">
          <Icon name="compass" size={28} className="text-sky-700 shrink-0" />
          <span className="text-sm">
            <b className="block text-gray-900">מעדיפים שנמליץ לכם?</b>
            <span className="text-xs text-gray-600">כמה שאלות קצרות, ומקבלים מכשיר וגרסה מדויקים</span>
          </span>
        </Link>
        <a
          href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent('שלום, קראתי את המדריך ויש לי שאלה')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-[#25D366]/10 border border-[#25D366]/40 rounded-2xl p-4 hover:border-[#25D366] transition"
        >
          <WhatsAppIcon size={28} color="#25D366" />
          <span className="text-sm">
            <b className="block text-gray-900">שאלה? כתבו לנו בוואטסאפ</b>
            <span className="text-xs text-gray-600">נגיד לכם בדיוק מה מתאים</span>
          </span>
        </a>
      </div>

      {/* לקריאה לעומק */}
      <section className="space-y-3 pt-2">
        <h2 className="font-black text-gray-900">רוצים לקרוא לעומק?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/guide/${g.slug}`} className="flex items-center gap-3 bg-white border-2 border-orange-100 hover:border-orange-300 rounded-2xl p-3 transition group">
              <GuideMark emoji={g.emoji} cert={g.cert} category={g.category} size={36} />
              <span className="min-w-0">
                <span className="block text-sm font-black text-gray-900 group-hover:text-orange-700 leading-snug">{g.title}</span>
                <span className="block text-[11px] text-gray-500">{g.minutes} דק׳ קריאה</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
