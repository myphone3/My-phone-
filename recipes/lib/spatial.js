// ניווט בשלט של הטלוויזיה: חצים עוברים לכפתור הקרוב ביותר בכיוון
export const KEY = {
  isLeft: (e) => e.key === 'ArrowLeft' || e.keyCode === 37,
  isRight: (e) => e.key === 'ArrowRight' || e.keyCode === 39,
  isUp: (e) => e.key === 'ArrowUp' || e.keyCode === 38,
  isDown: (e) => e.key === 'ArrowDown' || e.keyCode === 40,
  isOk: (e) => e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 23,
  isBack: (e) => ['Escape', 'Backspace', 'GoBack', 'BrowserBack', 'XF86Back'].includes(e.key) || [27, 8, 10009, 461, 4].includes(e.keyCode),
  isPlay: (e) => ['MediaPlayPause', 'MediaPlay', 'MediaPause'].includes(e.key) || [179, 415, 19, 10252].includes(e.keyCode),
};

// מודדים כל כפתור פעם אחת בכל לחיצה (טלוויזיות חלשות — כל מדידה עולה זמן)
function measure() {
  const out = [];
  for (const el of document.querySelectorAll('[data-nav]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && !el.closest('.hidden')) out.push([el, r]);
  }
  return out;
}

export function focusFirst(root = document) {
  const el = root.querySelector('[data-nav][data-autofocus]') || root.querySelector('[data-nav]');
  el?.focus({ preventScroll: false });
}

// fast: כשמחזיקים את החץ לחוץ — קופצים בלי אנימציה, כדי שהמסך לא יפגר אחרי השלט
export function moveFocus(dir, fast = false) {
  const els = measure();
  if (!els.length) return false;
  const cur = document.activeElement;
  const mine = els.find(([el]) => el === cur);
  if (!mine) { els[0][0].focus(); return true; }
  const a = mine[1];
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const [el, b] of els) {
    if (el === cur) continue;
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    let main, side;
    if (dir === 'left') { if (b.right > a.left + 2 && dx >= -2) continue; main = -dx; side = Math.abs(dy); }
    else if (dir === 'right') { if (b.left < a.right - 2 && dx <= 2) continue; main = dx; side = Math.abs(dy); }
    else if (dir === 'up') { if (b.bottom > a.top + 2 && dy >= -2) continue; main = -dy; side = Math.abs(dx); }
    else { if (b.top < a.bottom - 2 && dy <= 2) continue; main = dy; side = Math.abs(dx); }
    if (main < 0) continue;
    const score = main + side * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: fast ? 'auto' : 'smooth' });
    return true;
  }
  return false;
}
