import { app, $, views, go, store } from './common.js';
import './baby.js';
import './parent.js';

// ---------- מסך פתיחה ----------
views.home = function home() {
  app.innerHTML = `
    <div class="hero">
      <div class="moon"></div>
      <h1>ביבי-מוניטור</h1>
      <p class="muted">שמים מכשיר אחד בחדר של התינוק ומחברים אליו את המכשירים של ההורים. שומעים ורואים בשידור חי, מקבלים התראה כשהתינוק בוכה, ואפשר לחזור אחורה בהקלטות.</p>
    </div>
    <button class="card pick" id="baby"><b>👶 מכשיר התינוק</b><span class="muted">נשאר בחדר, מקשיב, מצלם ומקליט</span></button>
    <button class="card pick alt" id="parent"><b>🎧 מכשיר הורה</b><span class="muted">אפשר לחבר כמה הורים, וגם כמה חדרים</span></button>
    <ul class="tips">
      <li>האפליקציה ממשיכה לעבוד גם כשהמסך מוחשך.</li>
      <li>חברו את מכשיר התינוק למטען.</li>
      <li>שני המכשירים צריכים חיבור לאינטרנט, WiFi או סלולר.</li>
    </ul>`;
  $('#baby').onclick = () => go('baby');
  $('#parent').onclick = () => go('parent');
};

// אם האפליקציה נסגרה או שהטלפון הופעל מחדש באמצע, ממשיכים מאיפה שהיינו
const auto = store.get('bm-autostart');
if (auto === 'baby') go('baby', { auto: true });
else if (auto === 'parent') go('parent');
else go('home');
