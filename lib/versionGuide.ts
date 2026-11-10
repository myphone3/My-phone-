// הסבר על הגרסאות (רמות הסינון) של המכשירים: מה כל גרסה כוללת ומה לא.
// ההגדרות כאן הן ברירת מחדל. אפשר לשנות את התיאור, היכולות והלוגו של כל גרסה בפאנל (מסך "גרסאות"),
// ומה שנשמר בפאנל גובר על מה שכתוב כאן.
// כל יכולת היא "יש" או "אין", בלי אמצע: כך הלקוח יודע בדיוק מה הוא מקבל.

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

export type FeatureValue = 'yes' | 'no';

export const FEATURES: { key: FeatureKey; label: string; icon: string; hint: string }[] = [
  { key: 'calls', label: 'שיחות', icon: 'call', hint: 'שיחות קוליות נכנסות ויוצאות, אנשי קשר' },
  { key: 'sms', label: 'הודעות SMS', icon: 'sms', hint: 'שליחה וקבלה של הודעות טקסט' },
  { key: 'whatsapp', label: 'וואטסאפ', icon: 'chat', hint: 'וואטסאפ מסונן (בלי סטטוסים וקישורים)' },
  { key: 'camera', label: 'מצלמה', icon: 'camera', hint: 'צילום תמונות' },
  { key: 'gallery', label: 'גלריה', icon: 'image', hint: 'צפייה בתמונות ששמורות במכשיר' },
  { key: 'music', label: 'נגן שירים ושיעורים', icon: 'music', hint: 'השמעת קבצי שמע שהועברו למכשיר' },
  { key: 'navigation', label: 'ניווט ותחבורה', icon: 'map', hint: 'Waze, מוביט ואפליקציות תחבורה מאושרות' },
  { key: 'apps', label: 'אפליקציות מאושרות', icon: 'apps', hint: 'חנות מסוננת: רק אפליקציות שאושרו מראש' },
  { key: 'internet', label: 'דפדפן, גוגל ויוטיוב', icon: 'globe', hint: 'גלישה חופשית באינטרנט' },
];

export type VersionInfo = {
  name: string;
  title: string;
  /** שם אייקון (components/Icon) */
  icon: string;
  /** לוגו (למשל כשר פליי). אם אין, מוצג האייקון */
  logo?: string;
  description: string;
  /** למי הגרסה מתאימה, משפט קצר */
  bestFor?: string;
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
    icon: 'music',
    description: 'שיחות, נגן לשירים ושיעורים וצפייה בתמונות שהועברו למכשיר. בלי מצלמה, בלי הודעות ובלי אינטרנט.',
    bestFor: 'למי שרוצה לשמוע שירים ושיעורים, בלי מצלמה ובלי הודעות',
    features: { ...NONE, music: 'yes', gallery: 'yes' },
  },
  {
    name: 'נגן גלריה + הודעות sms',
    title: 'נגן + גלריה + SMS',
    icon: 'sms',
    description: 'כמו "נגן גלריה", ובנוסף שליחה וקבלה של הודעות SMS. בלי מצלמה ובלי אינטרנט.',
    bestFor: 'למי שצריך גם לשלוח ולקבל הודעות (קודים, תורים, עבודה)',
    features: { ...NONE, music: 'yes', gallery: 'yes', sms: 'yes' },
  },
  {
    name: 'נגן מצלמה',
    title: 'נגן + מצלמה',
    icon: 'camera',
    description: 'שיחות, נגן, גלריה ומצלמה לצילום תמונות. בלי הודעות ובלי אינטרנט.',
    bestFor: 'למי שרוצה לצלם את הילדים והאירועים, בלי הודעות',
    features: { ...NONE, music: 'yes', gallery: 'yes', camera: 'yes' },
  },
  {
    name: 'נגן מצלמה + הודעות sms',
    title: 'נגן + מצלמה + SMS',
    icon: 'camera',
    description: 'שיחות, נגן, גלריה, מצלמה והודעות SMS. בלי אינטרנט ובלי אפליקציות.',
    bestFor: 'הגרסה המלאה בלי אפליקציות: מצלמה וגם הודעות',
    features: { ...NONE, music: 'yes', gallery: 'yes', camera: 'yes', sms: 'yes' },
  },
  {
    name: 'כשר פליי בסיסי',
    title: 'כשר פליי',
    icon: 'apps',
    description:
      'חנות אפליקציות מסוננת: מתקינים רק אפליקציות שאושרו מראש, כמו וואטסאפ, Waze ומוביט. יש מצלמה, נגן והודעות. אין דפדפן, אין גוגל ואין יוטיוב.',
    bestFor: 'למי שצריך וואטסאפ, ניווט או מוביט, בלי אינטרנט פתוח',
    features: { ...NONE, sms: 'yes', music: 'yes', gallery: 'yes', camera: 'yes', whatsapp: 'yes', navigation: 'yes', apps: 'yes' },
  },
  {
    name: 'גירסה רגילה',
    title: 'גרסה פתוחה (ללא סינון)',
    icon: 'globe',
    description: 'המכשיר כפי שהוא מהיצרן, בלי סינון: אינטרנט, גוגל וכל האפליקציות. לא מתאים לקו כשר.',
    bestFor: 'למי שלא צריך סינון בכלל',
    features: { calls: 'yes', sms: 'yes', whatsapp: 'yes', camera: 'yes', gallery: 'yes', music: 'yes', navigation: 'yes', apps: 'yes', internet: 'yes' },
  },
];

// סוגי המכשירים: כשר / תומך כשר / פתוח (לטבלה הכללית במדריכים).
// בתומך כשר: "יש" = אפשר לקבל את זה באחת הגרסאות, ובוחרים גרסה לפי הצורך.
export const DEVICE_TYPES: VersionInfo[] = [
  {
    name: 'כשר',
    title: 'מכשיר כשר',
    icon: 'kosher',
    description: 'מאושר על ידי ועדת הרבנים לענייני תקשורת. שיחות בלבד: בלי הודעות, בלי מצלמה ובלי אינטרנט.',
    bestFor: 'רמת הכשרות המחמירה ביותר',
    features: { ...NONE },
  },
  {
    name: 'תומך כשר',
    title: 'תומך כשר',
    icon: 'supported',
    description: 'עובד עם קו כשר, ובוחרים גרסה: נגן, מצלמה, SMS, או כשר פליי עם וואטסאפ ומוביט. אין דפדפן ואין גוגל באף גרסה.',
    bestFor: 'מי שצריך יותר משיחות, בלי אינטרנט פתוח',
    features: { calls: 'yes', sms: 'yes', whatsapp: 'yes', camera: 'yes', gallery: 'yes', music: 'yes', navigation: 'yes', apps: 'yes', internet: 'no' },
  },
  {
    name: 'פתוח',
    title: 'סמארטפון פתוח',
    icon: 'globe',
    description: 'סמארטפון רגיל בלי סינון: אינטרנט, גוגל וכל האפליקציות.',
    bestFor: 'בלי סינון',
    features: { calls: 'yes', sms: 'yes', whatsapp: 'yes', camera: 'yes', gallery: 'yes', music: 'yes', navigation: 'yes', apps: 'yes', internet: 'yes' },
  },
];

const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .replace(/גירסה/g, 'גרסה')
    .replace(/[^֐-׿a-z0-9]+/g, ' ')
    .trim();

/** גרסת כשר פליי (לפי השם) */
export const isKosherPlay = (name: string) => /כשר ?פליי|kosher ?play/i.test(String(name || ''));

// ערכים ישנים ("limited") נחשבים "יש"
function cleanFeatures(raw: any): Partial<Record<FeatureKey, FeatureValue>> {
  const out: Partial<Record<FeatureKey, FeatureValue>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const f of FEATURES) {
    const v = raw[f.key];
    if (v === 'yes' || v === 'limited' || v === true) out[f.key] = 'yes';
    else if (v === 'no' || v === false) out[f.key] = 'no';
  }
  return out;
}

// מחבר בין רשימת הגרסאות מבסיס הנתונים (עם מה שנשמר בפאנל) לבין ברירות המחדל
export function resolveVersion(name: string, dbRows: any[] = []): VersionInfo {
  const row = dbRows.find((r) => norm(r?.name) === norm(name));
  const base = DEFAULT_VERSIONS.find((v) => norm(v.name) === norm(name)) || guessVersion(name);
  const dbFeatures = cleanFeatures(row?.features);
  const logo = (row?.image_url && String(row.image_url).trim()) || base.logo || (isKosherPlay(name) ? kosherPlayLogo(dbRows) : '');
  return {
    ...base,
    name,
    logo: logo || undefined,
    description: (row?.description && String(row.description).trim()) || base.description,
    features: Object.keys(dbFeatures).length ? { ...base.features, ...dbFeatures } : base.features,
  };
}

// הלוגו של כשר פליי: מכל גרסה בשם "כשר פליי" שהועלה לה לוגו בפאנל
function kosherPlayLogo(rows: any[]) {
  const r = rows.find((x) => isKosherPlay(x?.name) && x?.image_url);
  return r ? String(r.image_url) : '';
}

// גרסה חדשה שאין לה עדיין הגדרה: מנחשים לפי המילים בשם
function guessVersion(name: string): VersionInfo {
  const t = norm(name);
  const has = (re: RegExp) => re.test(t);
  const play = isKosherPlay(name);
  const features: Partial<Record<FeatureKey, FeatureValue>> = {
    ...NONE,
    sms: has(/sms|הודעות/) || play ? 'yes' : 'no',
    camera: has(/מצלמה/) || play ? 'yes' : 'no',
    gallery: has(/גלריה|מצלמה/) || play ? 'yes' : 'no',
    music: has(/נגן/) || play ? 'yes' : 'no',
    whatsapp: has(/וואטסאפ|ווטסאפ|whatsapp/) || play ? 'yes' : 'no',
    navigation: has(/ניווט|waze|מוביט/) || play ? 'yes' : 'no',
    apps: play || has(/אפליקציות/) ? 'yes' : 'no',
    internet: has(/פתוח|רגיל|אינטרנט/) ? 'yes' : 'no',
  };
  return { name, title: name, icon: play ? 'apps' : 'settings', description: '', features };
}

export const featureMark = (v?: FeatureValue | string) =>
  v === 'yes' || v === 'limited'
    ? { text: '✓', label: 'יש', cls: 'text-green-700 bg-green-50' }
    : { text: '✕', label: 'אין', cls: 'text-red-400 bg-red-50/60' };

/** מה יש ומה אין בגרסה, לרשימות */
export function splitFeatures(v: VersionInfo) {
  const yes = FEATURES.filter((f) => v.features[f.key] === 'yes');
  const no = FEATURES.filter((f) => v.features[f.key] !== 'yes');
  return { yes, no };
}
