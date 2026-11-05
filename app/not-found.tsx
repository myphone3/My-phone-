import Link from 'next/link';

export const metadata = { title: 'הדף לא נמצא | NEW PHONE' };

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center space-y-5" dir="rtl">
      <div className="text-6xl">📵</div>
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900">אופס, הדף לא נמצא</h1>
      <p className="text-sm text-gray-500 leading-6">
        ייתכן שהקישור שגוי, או שהמוצר כבר לא זמין. אבל יש לנו עוד הרבה דברים טובים בחנות.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Link href="/" className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-black text-sm transition">
          חזרה לחנות
        </Link>
        <Link href="/categories" className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 px-6 py-3 rounded-2xl font-bold text-sm transition">
          לכל הקטגוריות
        </Link>
      </div>
    </div>
  );
}
