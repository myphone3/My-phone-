// מזהה סרטון / פלייליסט מקישור של יוטיוב (גם youtu.be, music.youtube, shorts)
export function parseYouTube(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return { videoId: s, listId: null };
  let url;
  try { url = new URL(s.startsWith('http') ? s : 'https://' + s); } catch { return null; }
  if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(url.hostname)) return null;
  let videoId = url.searchParams.get('v');
  const listId = url.searchParams.get('list');
  if (!videoId && url.hostname.endsWith('youtu.be')) videoId = url.pathname.slice(1).split('/')[0];
  if (!videoId) {
    const m = url.pathname.match(/\/(shorts|embed|live|v)\/([\w-]{11})/);
    if (m) videoId = m[2];
  }
  if (videoId && !/^[\w-]{11}$/.test(videoId)) videoId = null;
  if (!videoId && !listId) return null;
  return { videoId: videoId || null, listId: listId || null };
}

export const thumb = (videoId) => (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null);
