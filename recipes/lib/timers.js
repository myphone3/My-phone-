'use client';
// טיימרים משותפים לטלפון ולטלוויזיה (נשמרים במצב המסונכרן)
import { useEffect, useRef, useState } from 'react';
import { beep } from './sound';

export const remaining = (t, now = Date.now()) => (t.endsAt ? (t.endsAt - now) / 1000 : t.left ?? 0);

export const addTimer = (update, label, minutes) => update((s) => ({
  timers: [...(s.timers || []), { id: Math.random().toString(36).slice(2, 9), label: label || 'טיימר', total: Math.round(minutes * 60), endsAt: Date.now() + minutes * 60000, left: null }].slice(-6),
}));
export const pauseTimer = (update, id) => update((s) => ({ timers: s.timers.map((t) => (t.id === id && t.endsAt ? { ...t, endsAt: null, left: Math.max(0, remaining(t)) } : t)) }));
export const resumeTimer = (update, id) => update((s) => ({ timers: s.timers.map((t) => (t.id === id && !t.endsAt ? { ...t, endsAt: Date.now() + (t.left || 0) * 1000, left: null } : t)) }));
export const plusTimer = (update, id, sec) => update((s) => ({ timers: s.timers.map((t) => (t.id !== id ? t : t.endsAt ? { ...t, endsAt: Math.max(Date.now(), t.endsAt) + sec * 1000 } : { ...t, left: (t.left || 0) + sec })) }));
export const removeTimer = (update, id) => update((s) => ({ timers: s.timers.filter((t) => t.id !== id) }));

export function useNow(active = true, ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(iv);
  }, [active, ms]);
  return now;
}

// מצפצף פעם אחת לכל טיימר שהסתיים, ומחזיר את הטיימרים שהסתיימו
export function useAlarms(timers, now) {
  const rung = useRef(new Set());
  const done = (timers || []).filter((t) => t.endsAt && remaining(t, now) <= 0);
  useEffect(() => {
    let fresh = false;
    for (const t of done) if (!rung.current.has(t.id)) { rung.current.add(t.id); fresh = true; }
    if (fresh) {
      beep(4);
      try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch {}
    }
  });
  useEffect(() => {
    if (!done.length) return;
    const iv = setInterval(() => beep(2), 6000);
    return () => clearInterval(iv);
  }, [done.length]);
  return done;
}
