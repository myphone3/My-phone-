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

function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

export function focusFirst(root = document) {
  const el = root.querySelector('[data-nav][data-autofocus]') || root.querySelector('[data-nav]');
  el?.focus({ preventScroll: false });
}

export function moveFocus(dir) {
  const els = [...document.querySelectorAll('[data-nav]')].filter(visible);
  if (!els.length) return false;
  const cur = document.activeElement;
  if (!cur || !els.includes(cur)) { els[0].focus(); return true; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
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
    best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    return true;
  }
  return false;
}
