import { FAQ } from '@/lib/storeInfo';

// רשימת שאלות נפוצות נפתחת (בלי JavaScript, עם details)
export default function FaqList() {
  return (
    <div className="space-y-2" dir="rtl">
      {FAQ.map((item) => (
        <details key={item.q} className="group bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-xs">
          <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-bold text-gray-900">
            <span>{item.q}</span>
            <span className="text-orange-600 text-lg leading-none transition group-open:rotate-45">+</span>
          </summary>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed pt-2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
