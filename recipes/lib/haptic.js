'use client';
// רטט קצר בלחיצה. באנדרואיד: navigator.vibrate.
// באייפון אין vibrate — אבל ספארי (iOS 18 ומעלה) נותן "טיק" של רטט כשמדליקים מתג (<input switch>).
// לכן לוחצים בשקט על מתג נסתר. עובד רק בתוך לחיצה של המשתמש, וזה בדיוק המצב כאן.
let sw = null, lbl = null, busy = false, last = 0;

function ensure() {
  if (lbl || typeof document === 'undefined') return;
  lbl = document.createElement('label');
  lbl.setAttribute('aria-hidden', 'true');
  lbl.dataset.haptic = '';
  Object.assign(lbl.style, { position: 'fixed', width: '1px', height: '1px', overflow: 'hidden', opacity: '0', pointerEvents: 'none', left: '-10px', top: '0' });
  sw = document.createElement('input');
  sw.type = 'checkbox';
  sw.setAttribute('switch', '');
  sw.tabIndex = -1;
  lbl.appendChild(sw);
  document.body.appendChild(lbl);
}

export function haptic(ms = 10) {
  const t = Date.now();
  if (busy || t - last < 35) return;
  last = t;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate && !/iPhone|iPad|iPod/.test(navigator.userAgent)) { navigator.vibrate(ms); return; }
    ensure();
    if (!lbl) return;
    busy = true;
    lbl.click();
  } catch {} finally { busy = false; }
}

// מפעיל רטט בכל לחיצה על כפתור באפליקציה
export function installHaptics() {
  if (typeof window === 'undefined') return () => {};
  const on = (e) => {
    const el = e.target?.closest?.('button, a, .chip, [role="button"], select, input[type="checkbox"], input[type="radio"]');
    if (!el || el.closest('[data-haptic]') || el.disabled) return;
    haptic();
  };
  const touch = () => {}; // בלי זה ספארי באייפון לא מציג את מצב "נלחץ" (:active) של הכפתורים
  document.addEventListener('click', on, true);
  document.addEventListener('touchstart', touch, { passive: true });
  return () => { document.removeEventListener('click', on, true); document.removeEventListener('touchstart', touch); };
}
