// התאמת שמות תגיות שה-AI הציע לתגיות שכבר קיימות בחנות (כולל עברית/אנגלית)
import { norm } from './kb';

export const ALIAS = {
  'סמסונג': 'samsung', 'גלקסי': 'samsung', 'אפל': 'apple', 'אייפון': 'apple', 'iphone': 'apple', 'שיאומי': 'xiaomi', 'רדמי': 'xiaomi', 'redmi': 'xiaomi',
  'גוגל': 'google', 'פיקסל': 'google', 'pixel': 'google', 'מוטורולה': 'motorola', 'נוקיה': 'nokia', 'וואווי': 'huawei', 'הואווי': 'huawei', 'וואן פלוס': 'oneplus',
  'partner': 'פרטנר', 'cellcom': 'סלקום', 'pelephone': 'פלאפון', 'hot mobile': 'הוט מובייל', 'הוט': 'הוט מובייל', 'hot': 'הוט מובייל',
  'golan': 'גולן טלקום', 'גולן': 'גולן טלקום', 'rami levy': 'רמי לוי', 'we com': 'וי קום', 'wecom': 'וי קום',
};

export function findTag(tags, kind, name) {
  const n = norm(name);
  if (!n) return null;
  const a = norm(ALIAS[n] || ALIAS[String(name).toLowerCase()] || '');
  const same = (t) => t.kind === kind && !t.deleted_at;
  return tags.find((t) => same(t) && norm(t.name) === n)
    || (a && tags.find((t) => same(t) && norm(t.name) === a))
    || tags.find((t) => same(t) && n.length >= 4 && (norm(t.name).includes(n) || n.includes(norm(t.name)) && norm(t.name).length >= 4))
    || null;
}

// {companies,devices,topics} → { ids: [...קיימות], fresh: [{kind,name,parent_name}] }
export function resolveSuggested(tags, s) {
  const ids = [];
  const fresh = [];
  const add = (kind, name) => {
    const t = findTag(tags, kind, name);
    if (t) { if (!ids.includes(t.id)) ids.push(t.id); return t; }
    const clean = String(name).trim().slice(0, 60);
    if (clean && !fresh.some((f) => f.kind === kind && norm(f.name) === norm(clean))) fresh.push({ kind, name: clean });
    return null;
  };
  const comps = (s.companies || []).map((n) => add('company', n));
  const firstCompany = comps.find(Boolean);
  for (const n of s.devices || []) {
    const t = add('device', n);
    if (!t && firstCompany) { const f = fresh.find((x) => x.kind === 'device' && x.name === String(n).trim().slice(0, 60)); if (f) f.parent_id = firstCompany.id; }
  }
  for (const n of s.topics || []) add('topic', n);
  return { ids, fresh };
}
