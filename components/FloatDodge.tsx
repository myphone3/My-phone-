'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// הכפתורים הצפים (וואטסאפ והנציג החכם) זזים למעלה כשיש מאחוריהם משהו ללחוץ עליו,
// וחוזרים למקום הרגיל בתחתית כשהמקום פנוי. הבדיקה נעשית כשהגלילה נעצרת, כדי שלא יקפצו תוך כדי.
// הכפתורים עצמם מסומנים ב-data-float, והמרחק נשמר במשתנה --float-shift על ה-body.

const STEP = 56; // כמה פיקסלים עולים בכל ניסיון
const MAX_SHARE = 0.42; // לא עולים מעל בערך אמצע המסך
const INTERACTIVE = 'button, input, select, textarea, label, summary, [role="button"], [role="switch"], [role="tab"], a';
const BIG_LINK_AREA = 26000; // קישור גדול (כרטיס מוצר שלם) לא נחשב "כפתור מוסתר"

function blocks(el: Element): boolean {
  if (el.closest('[data-float]')) return false;
  const target = el.closest(INTERACTIVE);
  if (!target) return false;
  if (target.closest('[data-float]')) return false;
  // הוראה להתעלם (למשל פס העוגיות, שהכפתורים כבר עולים מעליו)
  if (target.closest('[data-float-ignore]')) return false;
  if (target.tagName === 'A' && !target.matches('[role="button"]')) {
    const r = target.getBoundingClientRect();
    if (r.width * r.height > BIG_LINK_AREA) return false;
  }
  return true;
}

export default function FloatDodge() {
  const pathname = usePathname();

  useEffect(() => {
    const body = document.body;
    let shift = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const setShift = (v: number) => {
      if (v === shift) return;
      shift = v;
      body.style.setProperty('--float-shift', `${v}px`);
    };

    // האזור שהכפתורים תופסים כשהם במקום הרגיל
    const baseRect = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-float]'));
      if (!els.length) return null;
      let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        top = Math.min(top, r.top + shift);
        bottom = Math.max(bottom, r.bottom + shift);
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
      }
      // מרווח ביטחון קטן סביב הכפתורים
      const M = 8;
      return top === Infinity ? null : { top: top - M, bottom: bottom + M, left: left - M, right: right + M };
    };

    const isFree = (rect: { top: number; bottom: number; left: number; right: number }, up: number) => {
      const xs = [rect.left + 2, (rect.left + rect.right) / 2, rect.right - 2];
      for (let y = rect.top - up + 2; y <= rect.bottom - up - 2; y += 12) {
        for (const x of xs) {
          const hit = document.elementsFromPoint(x, y);
          for (const el of hit) {
            if (el.closest('[data-float]')) continue;
            if (blocks(el)) return false;
            break; // רק האלמנט העליון שמתחת לכפתורים משנה
          }
        }
      }
      return true;
    };

    const check = () => {
      // כשחלון הצ'אט פתוח, לא מזיזים כלום
      if (document.querySelector('[data-float-open]')) return;
      const rect = baseRect();
      if (!rect) return;
      const max = window.innerHeight * MAX_SHARE;
      for (let up = 0; up <= max; up += STEP) {
        if (isFree(rect, up)) {
          setShift(up);
          return;
        }
      }
      setShift(0); // אין מקום פנוי: נשארים בתחתית
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 180);
    };

    setShift(0);
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // תוכן שנטען אחרי הכניסה לעמוד (מוצרים, תמונות) יכול לשנות מה נמצא מאחורי הכפתורים
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
