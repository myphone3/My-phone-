'use client';
// שליטה בקול (ידיים מלוכלכות!) והקראת שלבים בקול
import { useEffect, useRef, useState } from 'react';

export const canListen = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let heVoice;
export function speak(text) {
  if (!canSpeak() || !text) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    heVoice = heVoice || synth.getVoices().find((v) => /^he|^iw/i.test(v.lang));
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    if (heVoice) u.voice = heVoice;
    u.rate = 0.95;
    synth.speak(u);
  } catch {}
}
export const stopSpeaking = () => { try { window.speechSynthesis?.cancel(); } catch {} };

// מזהה פקודה מתוך מה שנאמר
export function parseCommand(t) {
  const s = String(t || '').trim();
  if (/^(שאלה|שף|תגיד לי|כמה|במה|איך|מה)/.test(s) && s.split(/\s+/).length > 2) return { cmd: 'ask', text: s.replace(/^(שאלה|שף)\s*/, '') };
  const num = s.match(/(\d+)\s*(דקות|דקה)/);
  if (/טיימר|שעון/.test(s)) return { cmd: 'timer', minutes: num ? +num[1] : null };
  if (/עצור|הפסק|שקט|השתק/.test(s) && /מוזיק|שיר/.test(s)) return { cmd: 'pause' };
  if (/(נגן|תנגן|הפעל).*(מוזיק|שיר)|^מוזיקה$/.test(s)) return { cmd: 'play' };
  if (/שיר הבא|השיר הבא/.test(s)) return { cmd: 'song' };
  if (/מצרכים|מצרך/.test(s)) return { cmd: 'ingredients' };
  if (/שלב|תקריא|שוב|עוד פעם|מה עכשיו/.test(s) && !/הבא|קודם/.test(s)) return { cmd: 'repeat' };
  if (/הבא|קדימה|הלאה|המשך|סיימתי|נקסט/.test(s)) return { cmd: 'next' };
  if (/קודם|אחורה|חזור/.test(s)) return { cmd: 'prev' };
  return null;
}

export function useVoice(enabled, onCommand) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const cb = useRef(onCommand);
  cb.current = onCommand;
  useEffect(() => {
    if (!enabled || !canListen()) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec, stopped = false;
    const start = () => {
      if (stopped) return;
      rec = new SR();
      rec.lang = 'he-IL';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onstart = () => setListening(true);
      rec.onresult = (e) => {
        const r = e.results[e.results.length - 1];
        const text = r[0]?.transcript || '';
        setHeard(text);
        const c = parseCommand(text);
        if (c) cb.current(c, text);
      };
      rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopped = true; setListening(false); } };
      rec.onend = () => { setListening(false); if (!stopped) setTimeout(start, 300); };
      try { rec.start(); } catch {}
    };
    start();
    return () => { stopped = true; try { rec?.abort(); } catch {} setListening(false); };
  }, [enabled]);
  return { listening, heard };
}
