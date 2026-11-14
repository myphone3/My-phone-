// חיפוש ביוטיוב בלי מפתח: קוראים את דף התוצאות ושולפים סרטונים ופלייליסטים
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function extractJson(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  let j = html.indexOf('{', i);
  let depth = 0, inStr = false, esc = false;
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(j, k + 1)); } catch { return null; } } }
  }
  return null;
}

const text = (t) => (t ? t.simpleText || (t.runs || []).map((r) => r.text).join('') || t.content || '' : '');

function walk(node, out, seen) {
  if (!node || typeof node !== 'object' || out.length >= 40) return;
  if (Array.isArray(node)) { for (const n of node) walk(n, out, seen); return; }
  const v = node.videoRenderer;
  if (v?.videoId && !seen.has(v.videoId)) {
    seen.add(v.videoId);
    out.push({ type: 'video', videoId: v.videoId, title: text(v.title), author: text(v.ownerText || v.longBylineText), duration: text(v.lengthText), live: !v.lengthText });
    return;
  }
  const p = node.playlistRenderer;
  if (p?.playlistId && !seen.has(p.playlistId)) {
    seen.add(p.playlistId);
    out.push({ type: 'playlist', listId: p.playlistId, videoId: p.navigationEndpoint?.watchEndpoint?.videoId || null, title: text(p.title), author: text(p.shortBylineText || p.longBylineText), count: p.videoCount || '' });
    return;
  }
  const l = node.lockupViewModel;
  if (l?.contentId && /PLAYLIST|PODCAST|ALBUM/.test(l.contentType || '') && !seen.has(l.contentId)) {
    seen.add(l.contentId);
    const meta = l.metadata?.lockupMetadataViewModel;
    const watch = JSON.stringify(l).match(/"videoId":"([\w-]{11})"/);
    out.push({ type: 'playlist', listId: l.contentId, videoId: watch ? watch[1] : null, title: meta?.title?.content || '', author: '', count: '' });
    return;
  }
  for (const k in node) walk(node[k], out, seen);
}

export async function searchYouTube(q, kind = 'all') {
  const sp = kind === 'playlist' ? '&sp=EgIQAw%253D%253D' : kind === 'video' ? '&sp=EgIQAQ%253D%253D' : '';
  const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=he&gl=IL${sp}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1; SOCS=CAI' },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error('yt ' + r.status);
  const html = await r.text();
  const data = extractJson(html, 'var ytInitialData') || extractJson(html, 'ytInitialData"]');
  const out = [];
  walk(data?.contents || data, out, new Set());
  return out.filter((x) => x.title && !x.live).slice(0, 24);
}
