'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// הכפתורים הצפים (וואטסאפ והנציג החכם) יושבים קבוע בפינה התחתונה.
// הם זזים למעלה רק כשהם ממש מסתירים כפתור קטן (כמו מחיקה, פלוס/מינוס, סגירה),
// כך שאי אפשר ללחוץ עליו. כפתור שרובו גלוי ואפשר ללחוץ עליו, קישורים גדולים, כרטיסי מוצר
// ושדות רחבים לא מזיזים אותם. כשהם זזים, הם עולים רק בדיוק כמה שצריך כדי לפנות את הכפתור,
// ואף פעם לא לאמצע המסך. הבדיקה נעשית כשהגלילה נעצרת, כדי שלא יקפצו תוך כדי.
// הכפתורים עצמם מסומנים ב-data-float, והמרחק נשמר במשתנה --float-shift על ה-body.

const MAX_SHARE = 0.28; // הכי גבוה שמותר לעלות (חלק מגובה המסך). אם צריך יותר, נשארים למטה
const GAP = 10; // מרווח מעל הכפתור שפינינו
const MIN_VISIBLE = 0.5; // כפתור שלפחות חצי ממנו גלוי עדיין נחשב לחיץ
const MIN_TAP = 24; // וגם החלק הגלוי צריך להיות לפחות בגודל אצבע (פיקסלים)
const INTERACTIVE = 'button, input, select, textarea, label, summary, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], a';
const BIG_AREA = 26000; // אלמנט גדול (כרטיס מוצר שלם, שדה רחב) תמיד נשאר עם מספיק מקום ללחיצה

type Rect = { top: number; bottom: number; left: number; right: number };

function candidate(el: Element): HTMLElement | null {
  if (el.closest('[data-float]')) return null;
  const target = el.closest<HTMLElement>(INTERACTIVE);
  if (!target) return null;
  if (target.closest('[data-float]') || target.closest('[data-float-ignore]')) return null;
  if ((target as HTMLButtonElement).disabled) return null;
  const r = target.getBoundingClientRect();
  if (r.width * r.height > BIG_AREA) return null;
  return target;
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

    // המיקום של כל כפתור צף כשהוא במקום הרגיל שלו בתחתית
    const baseRects = (): Rect[] => {
      const M = 4;
      return Array.from(document.querySelectorAll<HTMLElement>('[data-float]'))
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => ({ top: r.top + shift - M, bottom: r.bottom + shift + M, left: r.left - M, right: r.right + M }));
    };

    const moved = (rects: Rect[], up: number) => rects.map((r) => ({ ...r, top: r.top - up, bottom: r.bottom - up }));
    const inside = (rects: Rect[], x: number, y: number) => rects.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);

    // האם הכפתורים הצפים (במיקום הזה) מסתירים את הכפתור כך שאי אפשר ללחוץ עליו
    const hidden = (target: HTMLElement, rects: Rect[]) => {
      const r = target.getBoundingClientRect();
      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, window.innerHeight);
      if (bottom - top < 4 || r.width < 4) return false;
      const cols = 8, rows = 6;
      let total = 0, covered = 0;
      let visLeft = Infinity, visRight = -Infinity, visTop = Infinity, visBottom = -Infinity;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = r.left + ((i + 0.5) * r.width) / cols;
          const y = top + ((j + 0.5) * (bottom - top)) / rows;
          total++;
          if (inside(rects, x, y)) covered++;
          else {
            visLeft = Math.min(visLeft, x); visRight = Math.max(visRight, x);
            visTop = Math.min(visTop, y); visBottom = Math.max(visBottom, y);
          }
        }
      }
      if (!covered) return false;
      const visible = (total - covered) / total;
      if (visible < MIN_VISIBLE) return true;
      // החלק הגלוי קטן מדי בשביל אצבע
      const stepX = r.width / cols, stepY = (bottom - top) / rows;
      return visRight - visLeft + stepX < MIN_TAP && visBottom - visTop + stepY < MIN_TAP;
    };

    // כל הכפתורים שנמצאים מתחת לכפתורים הצפים במיקום הזה
    const under = (rects: Rect[]) => {
      const found = new Set<HTMLElement>();
      for (const r of rects) {
        for (let y = r.top + 2; y <= r.bottom - 2; y += 8) {
          for (let x = r.left + 2; x <= r.right - 2; x += 8) {
            if (y < 0 || y > window.innerHeight) continue;
            for (const el of document.elementsFromPoint(x, y)) {
              if (el.closest('[data-float]')) continue;
              const t = candidate(el);
              if (t) found.add(t);
              break; // רק האלמנט העליון שמתחת לכפתורים משנה
            }
          }
        }
      }
      return Array.from(found);
    };

    const blockedAt = (base: Rect[], up: number) => {
      const rects = moved(base, up);
      return under(rects).filter((t) => hidden(t, rects));
    };

    const check = () => {
      // כשחלון הצ'אט פתוח, לא מזיזים כלום
      if (document.querySelector('[data-float-open]')) return;
      const base = baseRects();
      if (!base.length) return;
      const max = window.innerHeight * MAX_SHARE;
      const floatsBottom = Math.max(...base.map((r) => r.bottom));

      // במקום הרגיל לא מסתירים כלום: נשארים בתחתית
      let blocked = blockedAt(base, 0);
      if (!blocked.length) return setShift(0);

      // עולים בדיוק מעל הכפתור המוסתר (ואם במקום החדש מוסתר משהו אחר, ממשיכים קצת)
      let up = 0;
      for (let tries = 0; tries < 4 && blocked.length; tries++) {
        const highest = Math.min(...blocked.map((t) => t.getBoundingClientRect().top));
        up = Math.max(up + 1, Math.ceil(floatsBottom - highest + GAP));
        if (up > max) return setShift(0); // צריך לעלות גבוה מדי: עדיף להישאר בפינה
        blocked = blockedAt(base, up);
      }
      setShift(blocked.length ? 0 : up);
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(check, 220);
    };

    setShift(0);
    body.style.setProperty('--float-shift', '0px');
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // תוכן שנטען אחרי הכניסה לעמוד (מוצרים, תמונות, חלונות) יכול לשנות מה נמצא מאחורי הכפתורים
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
