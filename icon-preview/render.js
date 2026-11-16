const { chromium } = require('playwright');
const icons = require('./icons.js');
const names = { glass: '1 · זכוכית', neon: '2 · ניאון', morph: '3 · קבלה-מגן', ring: '4 · טבעת אחריות', scan: '5 · סריקה חכמה', wallet: '6 · ארנק קבלות' };
const ic = (svg, size, r = 0.225) => `<div style="width:${size}px;height:${size}px;border-radius:${size * r}px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.25)">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>`;
const dummy = ['#22c55e', '#f43f5e', '#0ea5e9', '#eab308', '#a855f7', '#64748b', '#f97316', '#14b8a6'];
const emo = ['📞', '📷', '🗺️', '☀️', '🎵', '⚙️', '🛒', '💬'];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2 });
  const big = Object.entries(icons).map(([k, s]) => `<div class="cell">${ic(s, 200)}<div class="nm">${names[k]}</div></div>`).join('');
  const phone = (k, dark) => {
    const cells = [];
    for (let i = 0; i < 8; i++) {
      if (i === 5) cells.push(`<div class="app">${ic(icons[k], 62)}<span>אחריות</span></div>`);
      cells.push(`<div class="app"><div style="width:62px;height:62px;border-radius:14px;background:${dummy[i]};display:grid;place-items:center;font-size:30px">${emo[i]}</div><span>אפליקציה</span></div>`);
    }
    return `<div class="phone ${dark ? 'dark' : ''}"><div class="grid">${cells.slice(0, 8).join('')}</div><div class="cap">${names[k]}</div></div>`;
  };
  const phones = Object.keys(icons).map((k, i) => phone(k, i % 2 === 1)).join('');
  await p.setContent(`<html dir="rtl"><body style="margin:0;background:#f1f1f6;font-family:system-ui,Arial;padding:36px">
  <style>.row{display:grid;grid-template-columns:repeat(3,1fr);gap:34px 20px;justify-items:center}.cell{display:flex;flex-direction:column;align-items:center;gap:12px}.nm{font-weight:800;font-size:22px;color:#222}
  .phones{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:44px}
  .phone{border-radius:34px;padding:26px 18px 16px;background:linear-gradient(160deg,#c7d2fe,#fbcfe8)}.phone.dark{background:linear-gradient(160deg,#1e293b,#312e81)}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 6px;justify-items:center}.app{display:flex;flex-direction:column;align-items:center;gap:5px}
  .app span{font-size:11px;color:#111}.dark .app span{color:#fff}.cap{text-align:center;margin-top:14px;font-weight:800;color:#333}.dark .cap{color:#fff}
  h1{margin:0 0 26px;text-align:center;font-size:30px}h2{text-align:center;margin:40px 0 0;font-size:24px}</style>
  <h1>אופציות לאייקון — קבלות ואחריות</h1><div class="row">${big}</div><h2>איך זה נראה במסך הבית</h2><div class="phones">${phones}</div></body></html>`);
  const h = await p.evaluate(() => document.body.scrollHeight);
  await p.setViewportSize({ width: 1200, height: h });
  await p.screenshot({ path: 'icon-options.png', fullPage: true });
  await b.close();
})();
