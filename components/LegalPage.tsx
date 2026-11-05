import Link from 'next/link';
import { BUSINESS } from '@/lib/business';

// מסגרת אחידה לעמודי המידע (תקנון, ביטולים, פרטיות, נגישות)
export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-20" dir="rtl">
      <Link href="/" className="inline-block text-xs font-bold text-orange-600 hover:text-orange-700 mb-4">
        → חזרה לחנות
      </Link>
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{title}</h1>
        <p className="text-xs text-gray-500 mt-2">עודכן לאחרונה: {BUSINESS.updated}</p>
        <div className="legal mt-6 space-y-6 text-sm leading-7 text-gray-700">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-black text-gray-900">{title}</h2>
      {children}
    </section>
  );
}
