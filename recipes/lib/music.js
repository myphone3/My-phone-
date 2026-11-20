'use client';
// מצב המוזיקה המשותף: תור שירים / פלייליסט מיוטיוב, איפה מנגנים, עוצמה, ערבוב וחזרה
export const MOODS = [
  { label: '🍳 רגוע לבישול', q: 'מוזיקה רגועה לבישול' },
  { label: '🕯️ שירי שבת', q: 'שירי שבת' },
  { label: '🇮🇱 ישראלי שקט', q: 'שירים ישראליים שקטים' },
  { label: '🎷 ג׳אז', q: 'jazz cooking music' },
  { label: '🎻 חסידי', q: 'מוזיקה חסידית' },
  { label: '📻 של פעם', q: 'שירים ישראליים של פעם' },
  { label: '🎹 קלאסי', q: 'מוזיקה קלאסית רגועה' },
  { label: '🎉 שמח', q: 'שירים שמחים' },
  { label: '👶 לילדים', q: 'שירי ילדים' },
  { label: '🌙 לפני שינה', q: 'מוזיקה מרגיעה' },
];

export const trackOf = (m) => (m ? (m.listId ? { videoId: m.listVideo || null, title: m.listTitle || 'פלייליסט' } : m.queue?.[m.index || 0] || null) : null);
export const trackKey = (m) => (!m ? '' : m.listId ? `L${m.listId}:${m.rev || 0}` : `V${trackOf(m)?.videoId || ''}:${m.index || 0}:${m.rev || 0}`);

const base = (m, output) => ({ output: m?.output || output || 'tv', volume: m?.volume ?? 60, shuffle: !!m?.shuffle, repeat: m?.repeat || 'all', playing: true, rev: (m?.rev || 0) + 1 });

export function playNow(update, item, output) {
  update((s) => {
    const m = s.music;
    if (item.listId) return { music: { ...base(m, output), listId: item.listId, listVideo: item.videoId || null, listTitle: item.title || 'פלייליסט', queue: m?.queue || [], index: 0 } };
    const queue = [{ videoId: item.videoId, title: item.title || '', author: item.author || '', duration: item.duration || '' }];
    if (m && !m.listId && m.queue?.length) {
      const rest = m.queue.slice((m.index || 0) + 1).filter((t) => t.videoId !== item.videoId);
      queue.push(...rest);
    }
    return { music: { ...base(m, output), listId: null, queue: queue.slice(0, 100), index: 0 } };
  });
}

export function addToQueue(update, item, output) {
  update((s) => {
    const m = s.music;
    const t = { videoId: item.videoId, title: item.title || '', author: item.author || '', duration: item.duration || '' };
    if (!m || m.listId) return { music: { ...base(m, output), listId: null, queue: [t], index: 0 } };
    return { music: { ...m, queue: [...(m.queue || []), t].slice(0, 100) } };
  });
}

export const setMusic = (update, patch) => update((s) => (s.music ? { music: { ...s.music, ...patch } } : {}));
export const jumpTo = (update, index) => update((s) => (s.music ? { music: { ...s.music, index, playing: true, rev: (s.music.rev || 0) + 1 } } : {}));
export const removeAt = (update, i) => update((s) => {
  const m = s.music;
  if (!m) return {};
  const queue = m.queue.filter((_, j) => j !== i);
  if (!queue.length) return { music: null };
  const idx = m.index || 0;
  const index = i < idx ? idx - 1 : Math.min(idx, queue.length - 1);
  return { music: { ...m, queue, index, rev: i === idx ? (m.rev || 0) + 1 : m.rev } };
});

// הבא / הקודם בתור (בפלייליסט של יוטיוב — הנגן עצמו מדלג)
export function nextIndex(m, dir = 1) {
  const n = m.queue?.length || 0;
  if (!n) return null;
  const i = m.index || 0;
  if (m.shuffle && n > 1 && dir > 0) { let r; do { r = Math.floor(Math.random() * n); } while (r === i); return r; }
  const j = i + dir;
  if (j >= n) return m.repeat === 'off' ? null : 0;
  if (j < 0) return n - 1;
  return j;
}

// פקודה לנגן — מגיעה גם למכשיר הזה וגם לשאר המכשירים (רק המכשיר שמנגן מבצע)
export function musicCmd(cast, cmd, arg) {
  cast.send('musicCmd', { cmd, arg });
  window.dispatchEvent(new CustomEvent('rc-music', { detail: { cmd, arg } }));
}

// כשהתור נגמר — מביאים עוד שירים דומים (של אותו אמן) כדי שהמוזיקה תמשיך לבד, כמו ביוטיוב
const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]|official|video|lyrics|קליפ|רשמי/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export async function similarTracks(m, cur) {
  const t = cur || trackOf(m);
  const q = (t?.author || t?.title || '').trim();
  if (!q) return [];
  try {
    const r = await fetch(`/api/yt-search?q=${encodeURIComponent(q)}&kind=video`);
    const { results = [] } = await r.json();
    const ids = new Set((m.queue || []).map((x) => x.videoId));
    const titles = new Set((m.queue || []).map((x) => norm(x.title)));
    const fresh = results.filter((x) => x.type === 'video' && x.videoId && !ids.has(x.videoId) && !titles.has(norm(x.title)));
    for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
    return fresh.slice(0, 8).map((x) => ({ videoId: x.videoId, title: x.title || '', author: x.author || '', duration: x.duration || '', auto: true }));
  } catch { return []; }
}
