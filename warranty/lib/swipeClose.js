// Swipe a popup window down to close it (phone).
// Any element with data-swipe-close is draggable down; letting go far/fast enough
// "taps" its backdrop (the parent element), which every window already treats as close.
// data-swipe-close="<selector>" instead taps that close button inside it (full-screen viewers).
// Starts only when the content under the finger is scrolled to the top, so normal
// scrolling inside a long window still works.
export function installSwipeClose() {
  if (typeof window === 'undefined' || window.__swipeClose) return;
  window.__swipeClose = true;
  let s = null;
  const scrolled = (t, panel) => {
    for (let e = t; e && e !== panel.parentElement; e = e.parentElement) if (e.scrollTop > 0) return true;
    return false;
  };
  const reset = (p, bg) => {
    p.style.transition = 'transform .22s ease-out';
    p.style.transform = '';
    if (bg) { bg.style.transition = 'opacity .22s'; bg.style.opacity = ''; }
    setTimeout(() => { p.style.transition = ''; if (bg) bg.style.transition = ''; }, 240);
  };
  document.addEventListener('touchstart', (e) => {
    s = null;
    if (e.touches.length !== 1) return;
    const t = e.target;
    const panel = t && t.closest && t.closest('[data-swipe-close]');
    if (!panel || t.closest('input[type=range], [data-no-swipe]') || scrolled(t, panel)) return;
    const sel = panel.getAttribute('data-swipe-close');
    const closer = sel ? () => { const b = panel.querySelector(sel); if (b) b.click(); } : () => panel.parentElement && panel.parentElement.click();
    s = { panel, closer, bg: sel ? null : panel.parentElement, x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), drag: false, dy: 0 };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (!s.drag) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { s = null; return; }
      if (dy < -6) { s = null; return; }
      if (dy > 10 && dy > Math.abs(dx)) {
        s.drag = true; s.y += 10; s.t = Date.now();
        s.panel.style.transition = 'none';
        if (document.activeElement && document.activeElement.blur && s.panel.contains(document.activeElement)) document.activeElement.blur();
      } else return;
    }
    if (e.cancelable) e.preventDefault();
    s.dy = Math.max(0, e.touches[0].clientY - s.y);
    s.panel.style.transform = `translateY(${s.dy}px)`;
    if (s.bg) s.bg.style.opacity = String(Math.max(0.35, 1 - s.dy / 500));
  }, { passive: false });
  const end = () => {
    if (!s) return;
    const { panel, bg, closer, drag, dy, t } = s;
    s = null;
    if (!drag) return;
    const v = dy / Math.max(1, Date.now() - t);
    if (dy > Math.min(140, panel.offsetHeight * 0.3) || (v > 0.6 && dy > 40)) {
      panel.style.transition = 'transform .18s ease-in';
      panel.style.transform = 'translateY(100%)';
      setTimeout(() => {
        closer();
        // still open (window refused to close)? bring it back
        setTimeout(() => { if (panel.isConnected) reset(panel, bg); }, 60);
      }, 170);
    } else reset(panel, bg);
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
