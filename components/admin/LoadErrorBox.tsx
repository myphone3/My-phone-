// טבלה שעוד לא נוצרה בבסיס הנתונים (קוד שגיאה של PostgREST/Postgres)
export const isMissingTable = (error: { code?: string } | null) => error?.code === 'PGRST205' || error?.code === '42P01';

// הודעה כשטעינת מסך בפאנל נכשלה: טבלה חסרה, או שגיאה אחרת עם כפתור לנסות שוב
export function LoadErrorBox({ error, what, onRetry }: { error: string; what: string; onRetry: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-sm text-amber-900 font-bold space-y-3" dir="rtl">
      <p>
        {error === 'missing'
          ? `מסך ${what} יעבוד אחרי שתתווסף לבסיס הנתונים הטבלה שלו.`
          : `לא הצלחנו לטעון את ${what}: ${error}`}
      </p>
      <button onClick={onRetry} className="bg-white border border-amber-300 px-4 py-2 rounded-xl text-xs cursor-pointer">
        לנסות שוב 🔄
      </button>
    </div>
  );
}
