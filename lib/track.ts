import { supabase } from './supabase';

// מעקב סטטיסטיקה של האתר עצמו (בלי שירות חיצוני): כניסות, צפיות במוצרים, הוספות לעגלה, חיפושים והזמנות.
// הפעולות נאספות בתור ונשלחות בקבוצות לפונקציה track בבסיס הנתונים.
// בלי הסכמה לעוגיות סטטיסטיקה: המבקר נספר רק בתוך הביקור הנוכחי, ולא מקושר לחשבון שלו.

export type Consent = 'all' | 'essential' | null;
export type TrackType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order'
  | 'search'
  | 'compare'
  | 'favorite'
  | 'quiz_done'
  | 'whatsapp_click'
  | 'assistant_open'
  | 'track_order';

const CONSENT_KEY = 'np_consent';
const SESSION_KEY = 'np_sid';
const VISITOR_KEY = 'np_vid';
const TEMP_VISITOR_KEY = 'np_vid_s';
const SOURCE_KEY = 'np_src';
const EXCLUDED_KEY = 'np_track_off';
const GEO_KEY = 'np_geo';

type QueuedEvent = { type: TrackType; path: string; product_id?: string; query?: string; results?: number; value?: number };

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let currentProduct: string | null = null;

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

const randomId = () =>
  safe(
    () => crypto.randomUUID(),
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`
  );

export function getConsent(): Consent {
  const v = safe(() => localStorage.getItem(CONSENT_KEY), null);
  return v === 'all' || v === 'essential' ? v : null;
}

export function setConsent(value: 'all' | 'essential') {
  safe(() => {
    localStorage.setItem(CONSENT_KEY, value);
    if (value === 'essential') localStorage.removeItem(VISITOR_KEY);
  }, undefined);
  window.dispatchEvent(new Event('consentChanged'));
}

// מנהלים לא נספרים בסטטיסטיקה (נקבע אחרי בדיקת is_admin)
export function setTrackingExcluded(excluded: boolean) {
  safe(() => (excluded ? sessionStorage.setItem(EXCLUDED_KEY, '1') : sessionStorage.removeItem(EXCLUDED_KEY)), undefined);
}
const isExcluded = () => safe(() => sessionStorage.getItem(EXCLUDED_KEY) === '1', false);

function ids() {
  return safe(
    () => {
      let session = sessionStorage.getItem(SESSION_KEY);
      if (!session) {
        session = randomId();
        sessionStorage.setItem(SESSION_KEY, session);
      }
      let visitor: string | null;
      if (getConsent() === 'all') {
        visitor = localStorage.getItem(VISITOR_KEY) || sessionStorage.getItem(TEMP_VISITOR_KEY);
        if (!visitor) visitor = randomId();
        localStorage.setItem(VISITOR_KEY, visitor);
      } else {
        visitor = sessionStorage.getItem(TEMP_VISITOR_KEY);
        if (!visitor) {
          visitor = randomId();
          sessionStorage.setItem(TEMP_VISITOR_KEY, visitor);
        }
      }
      return { session, visitor };
    },
    { session: '', visitor: '' }
  );
}

// מאיפה הגיע המבקר: נקבע פעם אחת בתחילת הביקור
function detectSource() {
  const saved = safe(() => sessionStorage.getItem(SOURCE_KEY), null);
  if (saved) return JSON.parse(saved) as { source: string; referrer: string; landing: string };

  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  const utm = params.get('utm_source');
  const referrer = document.referrer || '';
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  const ua = navigator.userAgent;
  const known: [RegExp, string][] = [
    [/google\./, 'גוגל'],
    [/bing\.|yahoo\.|duckduckgo/, 'מנוע חיפוש אחר'],
    [/facebook\.|fb\.|messenger/, 'פייסבוק'],
    [/instagram/, 'אינסטגרם'],
    [/whatsapp|wa\.me/, 'וואטסאפ'],
    [/tiktok/, 'טיקטוק'],
    [/youtube|youtu\.be/, 'יוטיוב'],
    [/t\.me|telegram/, 'טלגרם'],
  ];

  let source = 'ישיר';
  if (ref) source = `קמפיין: ${ref.toLowerCase().slice(0, 28)}`;
  else if (utm) source = utm.toLowerCase().slice(0, 40);
  else if (/FBAN|FBAV/.test(ua)) source = 'פייסבוק';
  else if (/Instagram/.test(ua)) source = 'אינסטגרם';
  else if (host && host !== window.location.hostname) {
    source = known.find(([re]) => re.test(host))?.[1] || host.slice(0, 40);
  }

  const value = { source, referrer: referrer.slice(0, 300), landing: (window.location.pathname + window.location.search).slice(0, 300) };
  safe(() => sessionStorage.setItem(SOURCE_KEY, JSON.stringify(value)), undefined);
  return value;
}

function device() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'טאבלט';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'טלפון';
  return 'מחשב';
}

function browser() {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV/.test(ua)) return 'אפליקציית פייסבוק';
  if (/Instagram/.test(ua)) return 'אפליקציית אינסטגרם';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/OPR\//.test(ua)) return 'Opera';
  if (/Firefox|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome|CriOS/.test(ua)) return 'Chrome';
  if (/Safari/.test(ua)) return 'Safari';
  return 'אחר';
}

export function cartSummary() {
  return safe(
    () => {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      if (!Array.isArray(cart)) return { items: 0, value: 0 };
      return cart.reduce(
        (acc: { items: number; value: number }, i: any) => {
          const q = Number(i?.quantity) || 1;
          return { items: acc.items + q, value: acc.value + (Number(i?.price) || 0) * q };
        },
        { items: 0, value: 0 }
      );
    },
    { items: 0, value: 0 }
  );
}

// עיר ואזור (פעם אחת בביקור, מהשרת של האתר). עד שהתשובה מגיעה נשלח בלי עיר
type Geo = { city?: string; region?: string; country?: string };
let geo: Geo | null = null;
let geoLoading = false;
function loadGeo(): Geo | null {
  if (geo) return geo;
  const saved = safe(() => sessionStorage.getItem(GEO_KEY), null);
  if (saved) {
    geo = safe<Geo>(() => JSON.parse(saved), {});
    return geo;
  }
  if (!geoLoading) {
    geoLoading = true;
    fetch('/api/geo')
      .then((r) => (r.ok ? r.json() : {}))
      .then((g: any) => {
        geo = { city: String(g.city || ''), region: String(g.region || ''), country: String(g.country || '') };
        safe(() => sessionStorage.setItem(GEO_KEY, JSON.stringify(geo)), undefined);
      })
      .catch(() => {
        geo = {};
      });
  }
  return null;
}

function info() {
  const src = detectSource();
  const cart = cartSummary();
  const g: Geo = loadGeo() || {};
  return {
    city: g.city || '',
    region: g.region || '',
    country: g.country || '',
    consent: getConsent() === 'all',
    path: window.location.pathname.slice(0, 300),
    product_id: currentProduct,
    source: src.source,
    referrer: src.referrer,
    landing: src.landing,
    device: device(),
    browser: browser(),
    cart_items: cart.items,
    cart_value: Math.round(cart.value),
  };
}

const tracking = () => typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin') && !isExcluded();

async function send(events: QueuedEvent[], keepalive = false) {
  if (!tracking()) return;
  const { session, visitor } = ids();
  if (!session || !visitor) return;
  const body = { p_session: session, p_visitor: visitor, p_info: info(), p_events: events };
  try {
    if (keepalive) {
      // סגירת הדף: שליחה שממשיכה גם אחרי שהדף נסגר
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return;
      await fetch(`${url}/rest/v1/rpc/track`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
    } else {
      await supabase.rpc('track', body);
    }
  } catch {
    // סטטיסטיקה היא תוספת: שגיאה לא מפריעה ללקוח
  }
}

export function flush(keepalive = false) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const batch = queue.slice(0, 20);
  queue = queue.slice(20);
  send(batch, keepalive);
  if (queue.length) flush(keepalive);
}

export function track(type: TrackType, data: Omit<QueuedEvent, 'type' | 'path'> = {}) {
  if (!tracking()) return;
  loadGeo(); // מתחילים להביא את העיר כבר עכשיו, כדי שתגיע עם השליחה
  queue.push({ type, path: window.location.pathname.slice(0, 300), ...data });
  if (!timer) timer = setTimeout(() => flush(), 1200);
}

// "עדיין כאן": מעדכן את רשימת "עכשיו באתר" ואת העגלה הפתוחה
export function heartbeat(keepalive = false) {
  if (queue.length) flush(keepalive);
  else send([], keepalive);
}

export function setCurrentProduct(id: string | null) {
  currentProduct = id;
}
