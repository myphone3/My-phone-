// מסך "הכל על המסך": מנסים כמה סידורים (מצרכים בעמודה אחת או שתיים, הוראות ב-1–3 עמודות)
// ובוחרים את זה שבו הכתב יוצא הכי גדול — כך שהכל נכנס ונקרא גם מרחוק.
const LAYOUTS = [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2]];

export function fitBoard(el) {
  if (!el) return null;
  const bi = el.querySelector('.bi');
  const bs = el.querySelector('.bs');
  const boxes = [el, ...el.querySelectorAll('[data-fit]')];
  const fits = () => boxes.every((c) => c.scrollHeight <= c.clientHeight + 1 && c.scrollWidth <= c.clientWidth + 1);
  const apply = ([ic, sc], fs) => {
    if (bi) { bi.style.columnCount = ic; bi.style.width = ic > 1 ? '42%' : ''; }
    if (bs) bs.style.columnCount = sc;
    el.style.setProperty('--fs', fs);
  };
  const best = { fs: 0, layout: LAYOUTS[0] };
  for (const layout of LAYOUTS) {
    apply(layout, best.fs || 0.42);
    if (!fits()) continue; // גם בגודל הכי קטן שכבר מצאנו זה לא נכנס — לא יעזור
    let lo = Math.max(best.fs, 0.42), hi = 2;
    apply(layout, hi);
    if (fits()) lo = hi;
    else for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; apply(layout, mid); if (fits()) lo = mid; else hi = mid; }
    if (lo > best.fs + 0.001) { best.fs = lo; best.layout = layout; }
  }
  apply(best.layout, Math.floor((best.fs || 0.42) * 100) / 100);
  return best;
}
