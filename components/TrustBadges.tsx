import { TRUST_ITEMS } from '@/lib/storeInfo';

// קוביות "למה לקנות אצלנו". compact: גרסה קטנה לעמוד המוצר
export default function TrustBadges({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2" dir="rtl">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <span className="text-lg">{item.icon}</span>
            <div className="leading-tight">
              <div className="text-[11px] font-black text-gray-900">{item.title}</div>
              <div className="text-[10px] text-gray-500">{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-8" dir="rtl">
      <h2 className="text-lg sm:text-xl font-black text-gray-900 border-r-4 border-orange-600 pr-3 mb-5">למה לקנות אצלנו?</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TRUST_ITEMS.map((item) => (
          <div key={item.title} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-50 flex items-center justify-center text-2xl">{item.icon}</div>
            <div className="text-sm font-black text-gray-900">{item.title}</div>
            <div className="text-xs text-gray-500">{item.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
