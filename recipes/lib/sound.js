// צפצוף לסיום טיימר (בלי קבצים)
let ctx;
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}
export function beep(times = 3) {
  try {
    unlockAudio();
    if (!ctx) return;
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.45;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, t);
      o.frequency.setValueAtTime(1175, t + 0.15);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    }
  } catch {}
}
