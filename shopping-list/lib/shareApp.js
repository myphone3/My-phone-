'use client';
// שיתוף האפליקציה עצמה — קישור נקי למסך הבית, בלי שום רשימה.
// מי שמקבל פותח רשימות משלו ולא רואה את הרשימות שלי.
export const appLink = () => (typeof location !== 'undefined' ? location.origin + '/' : '');
const TEXT = 'רשימת קניות חכמה 🛒 — רשימה שמתעדכנת אצל כל המשפחה בזמן אמת.\nפותחים רשימה משלכם כאן:';

export async function shareApp() {
  const url = appLink();
  if (navigator.share) {
    try { await navigator.share({ title: 'רשימת קניות', text: TEXT, url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  window.open('https://wa.me/?text=' + encodeURIComponent(TEXT + '\n' + url), '_blank');
}
export async function copyAppLink(say) {
  const url = appLink();
  try { await navigator.clipboard.writeText(url); say?.('🔗 הקישור לאפליקציה הועתק'); } catch { prompt('העתק את הקישור:', url); }
}

export function ShareAppBlock({ say }) {
  return (
    <div className="share-card" style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 800 }}>📲 לשתף את האפליקציה עם חבר</div>
      <div className="small muted" style={{ marginTop: 2 }}>הוא מקבל אפליקציה ריקה ופותח רשימות משלו. <b>הוא לא רואה את הרשימות שלך.</b></div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn grow" onClick={shareApp}>📤 שיתוף</button>
        <button className="btn grow" onClick={() => copyAppLink(say)}>🔗 העתק קישור</button>
      </div>
    </div>
  );
}
