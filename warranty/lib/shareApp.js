'use client';
// שיתוף האפליקציה עצמה — קישור נקי לדף הפתיחה, בלי שום ארכיון.
// מי שמקבל מתחיל ארכיון חדש משלו (או נכנס עם חשבון Google שלו) ולא רואה את הקבלות שלי.
export const appLink = () => (typeof location !== 'undefined' ? location.origin + '/' : '');
const TEXT = 'קבלות ואחריות 🧾 — מצלמים קבלה והאפליקציה זוכרת עד מתי האחריות.\nכל אחד פותח ארכיון משלו (אפשר עם חשבון Google):';

export async function shareApp(say) {
  const url = appLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'קבלות ואחריות', text: TEXT, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  location.href = 'https://wa.me/?text=' + encodeURIComponent(TEXT + '\n' + url);
}
export async function copyAppLink(say) {
  const url = appLink();
  try { await navigator.clipboard.writeText(url); say?.('🔗 הקישור לאפליקציה הועתק'); } catch { prompt('העתק את הקישור:', url); }
}

export function ShareAppBlock({ say }) {
  return (
    <div className="card" style={{ padding: 14, marginTop: 12 }}>
      <b>📲 לשתף את האפליקציה עם חבר</b>
      <div className="muted small" style={{ margin: '4px 0 10px' }}>הוא מקבל אפליקציה ריקה ופותח חשבון משלו. <b>הוא לא רואה את הקבלות שלך.</b></div>
      <div className="grid2">
        <button className="btn" onClick={() => shareApp(say)}>📤 שיתוף</button>
        <button className="btn" onClick={() => copyAppLink(say)}>🔗 העתק קישור</button>
      </div>
    </div>
  );
}
