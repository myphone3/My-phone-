'use client';

import Link from 'next/link';
import Icon from './Icon';
import { CertLogo } from './ProductExtras';
import { KosherPlayMark } from './Logos';

// הסבר פשוט: מכשיר כשר מול תומך כשר. מופיע בדף הבית ובמדריכים.
// בטלפונים יש כשרות אחת בלבד: ועדת הרבנים לענייני תקשורת.

export const PHONE_CERT = 'ועדת הרבנים';

type Row = { ok: boolean; text: string; note?: string };

const KOSHER_ROWS: Row[] = [
  { ok: true, text: 'שיחות נכנסות ויוצאות' },
  { ok: true, text: 'אנשי קשר, שעון ומעורר' },
  { ok: false, text: 'הודעות SMS' },
  { ok: false, text: 'מצלמה ותמונות' },
  { ok: false, text: 'וואטסאפ ואפליקציות' },
  { ok: false, text: 'אינטרנט' },
];

const SUPPORTED_ROWS: Row[] = [
  { ok: true, text: 'שיחות נכנסות ויוצאות' },
  { ok: true, text: 'הודעות SMS', note: 'לפי הגרסה' },
  { ok: true, text: 'מצלמה, גלריה ונגן שירים', note: 'לפי הגרסה' },
  { ok: true, text: 'וואטסאפ, Waze ומוביט', note: 'רק בכשר פליי' },
  { ok: false, text: 'אינטרנט ודפדפן' },
  { ok: false, text: 'גוגל וחנות אפליקציות פתוחה' },
];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.text} className="flex items-center gap-2.5 text-sm">
          <span
            className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${r.ok ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}
            aria-label={r.ok ? 'יש' : 'אין'}
          >
            <Icon name={r.ok ? 'check' : 'x'} size={14} strokeWidth={2.4} />
          </span>
          <span className={`font-bold ${r.ok ? 'text-gray-900' : 'text-gray-400 line-through decoration-gray-300'}`}>{r.text}</span>
          {r.note && <span className="text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">{r.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function KosherExplainer({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid md:grid-cols-2 gap-4">
        {/* מכשיר כשר */}
        <div className="bg-white border-2 border-orange-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <CertLogo
              name={PHONE_CERT}
              size={56}
              className="border border-gray-100 p-1"
              fallback={
                <span className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Icon name="kosher" size={30} />
                </span>
              }
            />
            <div>
              <h3 className="text-lg font-black text-gray-900">מכשיר כשר</h3>
              <p className="text-xs text-gray-500 font-medium">מאושר על ידי ועדת הרבנים לענייני תקשורת</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 bg-orange-50 rounded-2xl px-3 py-2.5 leading-relaxed">
            <b>במילה אחת: רק לדבר.</b> טלפון פשוט עם מקשים, בלי שום דבר מעבר לשיחות.
          </p>
          <Rows rows={KOSHER_ROWS} />
          {!compact && (
            <p className="text-xs text-gray-500 border-t pt-3">
              <b className="text-gray-800">מתאים ל:</b> מי שרוצה את הכשרות המחמירה ביותר, מבוגרים, ומי שצריך טלפון רק לשיחות.
            </p>
          )}
          <Link href={`/category/${encodeURIComponent('מכשירים כשרים')}`} className="block text-center bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl text-xs font-black transition">
            למכשירים הכשרים ←
          </Link>
        </div>

        {/* תומך כשר */}
        <div className="bg-white border-2 border-sky-200 rounded-3xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <Icon name="supported" size={32} />
            </span>
            <div>
              <h3 className="text-lg font-black text-gray-900">מכשיר תומך כשר</h3>
              <p className="text-xs text-gray-500 font-medium">עובד עם קו כשר, עם סינון שבוחרים</p>
            </div>
          </div>
          <p className="text-sm text-gray-700 bg-sky-50 rounded-2xl px-3 py-2.5 leading-relaxed">
            <b>במילה אחת: בוחרים מה פתוח.</b> מכשיר עם מסך מגע, ובוחרים גרסה לפי מה שצריך.
          </p>
          <Rows rows={SUPPORTED_ROWS} />
          {!compact && (
            <p className="text-xs text-gray-500 border-t pt-3 flex items-start gap-1.5">
              <KosherPlayMark size={18} />
              <span>
                <b className="text-gray-800">צריכים וואטסאפ או ניווט?</b> בוחרים גרסת כשר פליי: חנות אפליקציות מסוננת, בלי דפדפן ובלי גוגל.
              </span>
            </p>
          )}
          <Link href={`/category/${encodeURIComponent('תומך כשר')}`} className="block text-center bg-sky-700 hover:bg-sky-800 text-white py-2.5 rounded-xl text-xs font-black transition">
            למכשירים התומכי כשר ←
          </Link>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
          <span className="text-xs text-gray-600 font-medium">עדיין לא בטוחים מה מתאים לכם?</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('openAssistant'))}
            className="text-xs font-black text-orange-700 bg-white border border-orange-200 hover:border-orange-400 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Icon name="bot" size={14} /> הנציג החכם ימליץ לכם על מכשיר
          </button>
          <Link href="/guide/kosher-vs-supported" className="text-xs font-bold text-gray-500 hover:text-orange-700 underline">
            או קראו את ההסבר המלא
          </Link>
        </div>
      )}
    </div>
  );
}
