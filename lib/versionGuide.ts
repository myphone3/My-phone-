// הסבר על הגרסאות (רמות הסינון) של המכשירים: מה כל גרסה כוללת ומה לא.
// ההגדרות כאן הן ברירת מחדל. אפשר לשנות את התיאור והיכולות של כל גרסה בפאנל (מסך "גרסאות"),
// ומה שנשמר בפאנל גובר על מה שכתוב כאן.

export type FeatureKey =
  | 'calls'
  | 'sms'
  | 'whatsapp'
  | 'camera'
  | 'gallery'
  | 'music'
  | 'navigation'
  | 'apps'
  | 'internet';

// yes = יש · no = אין · limited = מוגבל / לפי מה שמאושר
export type FeatureValue = 'yes' | 'no' | 'limited';

export const FEATURES: { key: FeatureKey; label: string; icon: string; hint: string }[] = [
  { key: 'calls', label: 'שיחות', icon: '📞', hint: 'שיחות קוליות רגילות' },
  { key: 'sms', label: 'הודעות SMS', icon: '✉️', hint: 'שליחה וקבלה של הודעות טקסט' },
  { key: 'whatsapp', label: 'וואטסאפ', icon: '💬', hint: 'וואטסאפ (לפעמים בגרסה מוגבלת, למשל בלי קבוצות או סטטוסים)' },
  { key: 'camera', label: 'מצלמה', icon: '📷', hint: 'צילום תמונות' },
  { key: 'gallery', label: 'גלריה', icon: '🖼️', hint: 'צפייה בתמונות ששמורות במכשיר' },
  { key: 'music', label: 'נגן שירים ושיעורים', icon: '🎵', hint: 'השמעת קבצי שמע שהועברו למכשיר' },
  { key: 'navigation', label: 'ניווט ותחבורה', icon: '🗺️', hint: 'אפליקציות כמו Waze ומוביט' },
  { key: 'apps', label: 'חנות אפליקציות מסוננת', icon: '🧩', hint: 'רק אפליקציות שאושרו מראש' },
  { key: 'internet', label: 'גלישה ו-Google', icon: '🌐', hint: 'דפדפן, חיפוש בגוגל, יוטיוב' },
];

export type VersionInfo = {
  name: string;
  title: string;
  icon: string;
  description: string;
  features: Partial<Record<FeatureKey, FeatureValue>>;
};

const NONE: Partial<Record<FeatureKey, FeatureValue>> = {
  calls: 'yes',
  sms: 'no',
  whatsapp: 'no',
  camera: 'no',
  gallery: 'no',
  music: 'no',
  navigation: 'no',
  apps: 'no',
  internet: 'no',
};

// גרסאות שהחנות מוכרת היום (לפי השמות במסך "גרסאות")
export const DEFAULT_VERSIONS: VersionInfo[] = [
  {
    name: 'נגן גלריה',
    title: 'נגן + גלריה',
    icon: '🎵',
    description: 'שיחות, נגן לשירים ושיעורים וצפייה בתמונות. בלי מצלמה, בלי הודעות ובלי אינטרנט.',
    features: { ...NONE, music: 'yes', gallery: 'yes' },
  },
  {
    name: 'נגן גלריה + הודעות sms',
    title: 'נגן + גלריה + SMS',
    icon: '✉️',
    description: 'כמו "נגן גלריה", ובנוסף שליחה וקבלה של הודעות SMS. בלי מצלמה ובלי אינטרנט.',
    features: { ...NONE, music: 'yes', gallery: 'yes', sms: 'yes' },
  },
  {
    name: 'נגן מצלמה',
    title: 'נגן + מצלמה',
    icon: '📷',
    description: 'שיחות, נגן, גלריה ומצלמה לצילום תמונות. בלי הודעות ובלי אינטרנט.',
    features: { ...NONE, music: 'yes', gallery: 'yes', camera: 'yes' },
  },
  {
    name: 'נגן מצלמה + הודעות sms',
    title: 'נגן + מצלמה + SMS',
    icon: '📸',
    description: 'שיחות, נגן, גלריה, מצלמה והודעות SMS. בלי אינטרנט ובלי אפליקציות.',
    features: { ...NONE, music: 'yes', gallery: 'yes', camera: 'yes', sms: 'yes' },
  },
  {
    name: 'כשר פליי בסיסי',
    title: 'כשר פליי (אפליקציות מסוננות)',
    icon: '🧩',
    description:
      'מכשיר עם חנות אפליקציות מסוננת: אפשר להתקין רק אפליקציות שאושרו מראש, כמו וואטסאפ, ניווט ותחבורה ציבורית. בלי דפדפן ובלי גוגל.',
    features: { ...NONE, sms: 'yes', music: 'yes', gallery: 'yes', camera: 'yes', whatsapp: 'limited', navigation: 'limited', apps: 'yes' },
  },
  {
    name: 'גירסה רגילה',
    title: 'גרסה פתוחה (ללא סינון)',
    icon: '🌐',
    description: 'המכשיר כפי שהוא מהיצרן, בלי סינון: אינטרנט, גוגל וכל האפליקציות. לא מתאים לקו כשר.',
    features: { calls: 'yes', sms: 'yes', whatsapp: 'yes', camera: 'yes', gallery: 'yes', music: 'yes', navigation: 'yes', apps: 'yes', internet: 'yes' },
  },
];

// סוגי המכשירים: כשר / תומך כשר / פתוח (לטבלה הכללית במדריכים)
export const DEVICE_TYPES: VersionInfo[] = [
  {
    name: 'כשר',
    title: 'מכשיר כשר',
    icon: '✡️',
    description: 'מאושר על ידי ועדת הרבנים לענייני תקשורת. שיחות בלבד: בלי הודעות, בלי מצלמה ובלי אינטרנט.',
    features: { ...NONE },
  },
  {
    name: 'תומך כשר',
    title: 'תומך כשר',
    icon: '✅',
    description: 'מכשיר שעובד עם קו כשר, עם סינון ברמה שבוחרים: מנגן ומצלמה, דרך SMS, ועד אפליקציות מאושרות כמו וואטסאפ ומוביט.',
    features: { calls: 'yes', sms: 'limited', whatsapp: 'limited', camera: 'limited', gallery: 'limited', music: 'limited', navigation: 'limited', apps: 'limited', internet: 'no' },
  },
  {
    name: 'פתוח',
    title: 'סמארטפון פתוח',
    icon: '🌐',
    description: 'סמארטפון רגיל בלי סינון: אינטרנט, גוגל וכל האפליקציות.',
    features: { calls: 'yes', sms: 'yes', whatsapp: 'yes', camera: 'yes', gallery: 'yes', music: 'yes', navigation: 'yes', apps: 'yes', internet: 'yes' },
  },
];

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/גירסה/g, 'גרסה')
    .replace(/[^֐-׿a-z0-9]+/g, ' ')
    .trim();

// מחבר בין רשימת הגרסאות מבסיס הנתונים (עם מה שנשמר בפאנל) לבין ברירות המחדל
export function resolveVersion(name: string, dbRows: any[] = []): VersionInfo {
  const row = dbRows.find((r) => norm(r?.name) === norm(name));
  const base = DEFAULT_VERSIONS.find((v) => norm(v.name) === norm(name)) || guessVersion(name);
  const dbFeatures = row?.features && typeof row.features === 'object' && !Array.isArray(row.features) ? row.features : null;
  return {
    ...base,
    name,
    description: (row?.description && String(row.description).trim()) || base.description,
    features: dbFeatures && Object.keys(dbFeatures).length ? { ...base.features, ...dbFeatures } : base.features,
  };
}

// גרסה חדשה שאין לה עדיין הגדרה: מנחשים לפי המילים בשם
function guessVersion(name: string): VersionInfo {
  const t = norm(name);
  const has = (re: RegExp) => re.test(t);
  const features: Partial<Record<FeatureKey, FeatureValue>> = {
    ...NONE,
    sms: has(/sms|הודעות/) ? 'yes' : 'no',
    camera: has(/מצלמה/) ? 'yes' : 'no',
    gallery: has(/גלריה|מצלמה/) ? 'yes' : 'no',
    music: has(/נגן/) ? 'yes' : 'no',
    whatsapp: has(/וואטסאפ|ווטסאפ|whatsapp/) ? 'yes' : 'no',
    navigation: has(/ניווט|waze|מוביט/) ? 'yes' : 'no',
    apps: has(/פליי|play|אפליקציות/) ? 'yes' : 'no',
    internet: has(/פתוח|רגיל|אינטרנט/) ? 'yes' : 'no',
  };
  return { name, title: name, icon: '⚙️', description: '', features };
}

export const featureMark = (v?: FeatureValue) =>
  v === 'yes' ? { text: '✓', label: 'יש', cls: 'text-green-700 bg-green-50' } : v === 'limited' ? { text: '◐', label: 'מוגבל', cls: 'text-amber-800 bg-amber-50' } : { text: '✕', label: 'אין', cls: 'text-gray-400 bg-gray-50' };
