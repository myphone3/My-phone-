import Link from 'next/link';

// תיבת הסבר קצרה בראש קטגוריות "מכשירים כשרים" ו"תומך כשר", עם קישור למדריך המלא
const EXPLAINERS: { match: RegExp; icon: string; title: string; text: string; href: string }[] = [
  {
    match: /תומך/,
    icon: '✅',
    title: 'מה זה תומך כשר?',
    text: 'מכשיר שעובד עם קו כשר, בגרסה שאתם בוחרים: נגן וגלריה, מצלמה, הודעות SMS, או אפליקציות מאושרות כמו וואטסאפ ומוביט. בלי דפדפן ובלי גוגל.',
    href: '/guide/kosher-supported',
  },
  {
    match: /כשר/,
    icon: '✡️',
    title: 'מה זה מכשיר כשר?',
    text: 'מכשיר באישור ועדת הרבנים לענייני תקשורת, לשיחות בלבד: בלי הודעות, בלי מצלמה ובלי אינטרנט.',
    href: '/guide/kosher-phone',
  },
  {
    match: /נגן/,
    icon: '🎧',
    title: 'איך בוחרים נגן?',
    text: 'נגנים בלי אינטרנט לשירים ושיעורים. כדאי לשים לב לנפח, לסוג המסך ולהכשר.',
    href: '/guide/kosher-players',
  },
];

export default function CategoryExplainer({ name }: { name: string }) {
  const e = EXPLAINERS.find((x) => x.match.test(name));
  if (!e) return null;
  return (
    <div className="flex items-start gap-3 bg-white border-2 border-orange-100 rounded-2xl p-4">
      <span className="text-2xl leading-none">{e.icon}</span>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-black text-gray-900">{e.title}</p>
        <p className="text-xs text-gray-600 leading-relaxed">{e.text}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <Link href={e.href} className="text-xs font-black text-orange-700 underline underline-offset-4">
            למדריך המלא ←
          </Link>
          <Link href="/guide/kosher-vs-supported" className="text-xs font-bold text-gray-500 underline underline-offset-4">
            כשר או תומך כשר?
          </Link>
        </div>
      </div>
    </div>
  );
}
