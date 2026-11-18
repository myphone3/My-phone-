// קריאת קובץ ייצוא של צ'אט וואטסאפ (txt, או zip שיש בו txt)
const MARKS = /[‎‏‪-‮⁦-⁩﻿]/g;
// [18.11.2026, 10:23:45] שם: טקסט   |   18/11/2026, 10:23 - שם: טקסט
const LINE = /^\[?(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([AaPp][Mm]))?\]?\s*(?:-\s*)?(.*)$/;
const SKIP = /^(<?(media omitted|המדיה לא נכללה|המדיה הושמטה)>?|.*(image|video|audio|sticker|gif|document) omitted|.*(התמונה|הסרטון|האודיו|המדבקה|הקובץ|המסמך) (הושמט|הושמטה)|this message was deleted|ההודעה נמחקה|you deleted this message|מחקת את ההודעה|null|<this message was edited>|<ההודעה נערכה>)$/i;

export function parseChat(raw) {
  const lines = String(raw || '').replace(MARKS, '').split(/\r?\n/);
  const msgs = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(LINE);
    if (m) {
      let [, d, mo, y, h, mi, ap, rest] = m;
      y = y.length === 2 ? '20' + y : y;
      h = +h;
      if (ap) { if (/p/i.test(ap) && h < 12) h += 12; if (/a/i.test(ap) && h === 12) h = 0; }
      const at = new Date(+y, +mo - 1, +d, h, +mi);
      const c = rest.indexOf(': ');
      if (c <= 0 || c > 40) { cur = null; continue; } // הודעת מערכת
      cur = { at: isNaN(at) ? null : at.toISOString(), from: rest.slice(0, c).trim(), text: rest.slice(c + 2) };
      msgs.push(cur);
    } else if (cur) {
      cur.text += '\n' + line;
    }
  }
  return msgs
    .map((x) => ({ ...x, text: x.text.replace(/\s*<(This message was edited|ההודעה נערכה)>\s*$/i, '').trim() }))
    .filter((x) => x.text && !SKIP.test(x.text));
}

// מאחד הודעות רצופות של אותו אדם בהפרש של עד 2 דקות (הרבה פעמים כותבים מידע אחד בכמה הודעות)
export function groupMessages(msgs) {
  const out = [];
  for (const m of msgs) {
    const prev = out[out.length - 1];
    if (prev && prev.from === m.from && m.at && prev.last && new Date(m.at) - new Date(prev.last) <= 120000 && prev.text.length < 1500) {
      prev.text += '\n' + m.text; prev.last = m.at;
    } else out.push({ ...m, last: m.at });
  }
  return out.map(({ last, ...x }, i) => ({ ...x, i }));
}

export async function readChatFile(file) {
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const txt = Object.values(zip.files).find((f) => !f.dir && /\.txt$/i.test(f.name));
    if (!txt) throw new Error('לא נמצא קובץ טקסט בתוך ה-ZIP');
    return txt.async('string');
  }
  return file.text();
}
