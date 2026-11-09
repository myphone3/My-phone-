'use client';

// פותח מחדש את הודעת העוגיות כדי לשנות את הבחירה
export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('open-consent'))}
      className="inline-block bg-orange-50 border border-orange-200 text-orange-700 px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
    >
      🍪 שינוי הבחירה שלי לגבי עוגיות
    </button>
  );
}
