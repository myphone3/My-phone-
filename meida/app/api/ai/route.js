// סידור אוטומטי של מידע (AI): פריט בודד, ייבוא מוואטסאפ, ושאלות על המאגר.
// רק עובד מאושר בחנות יכול להשתמש (בודקים את כרטיס הכניסה מול Supabase).
import { createClient } from '@supabase/supabase-js';
import { askJSON, hasAI } from '@/lib/ai';
import { TYPES, ALL_FIELDS } from '@/lib/kb';

export const runtime = 'nodejs';
export const maxDuration = 60;

const str = (v, n) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().slice(0, n) : '');

async function member(req, shop) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !/^[0-9a-f-]{36}$/.test(shop || '')) return false;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false },
  });
  const { data, error } = await sb.rpc('kb_is_member', { p_shop: shop });
  return !error && data === true;
}

const TYPE_LIST = TYPES.map((t) => `${t.k} (${t.label}${t.fields.length ? ': ' + t.fields.join(', ') : ''})`).join('; ');

function tagList(tags) {
  const by = { company: [], device: [], topic: [] };
  for (const t of (tags || []).slice(0, 400)) if (by[t.kind]) by[t.kind].push(str(t.name, 60));
  return `חברות: ${by.company.join(', ') || '-'}\nמכשירים: ${by.device.join(', ') || '-'}\nנושאים: ${by.topic.join(', ') || '-'}`;
}

const ITEM_RULES = `כל פריט במבנה:
{"title":"כותרת קצרה וברורה בעברית (עד 60 תווים) — מה זה, למשל 'קוד ריסט לסמסונג A54' או 'נקודת שירות שיאומי - בני ברק'",
"type":"אחד מ: ${TYPES.map((t) => t.k).join(', ')}",
"body":"הטקסט המלא והמסודר (אפשר שורות). לא לאבד שום פרט — מספרים, קודים, שמות, שעות",
"fields":{${ALL_FIELDS.map((f) => `"${f}":""`).join(',')}} — רק מה שמופיע בטקסט, השאר אל תכלול,
"companies":["שמות חברות (יצרן מכשיר / חברת סלולר / יבואן)"],"devices":["דגמים, למשל Galaxy A54, iPhone 15 Pro"],"topics":["נושאים"]}
סוגים: ${TYPE_LIST}.
תגיות: העדף שמות שכבר קיימים ברשימה (בדיוק באותו כתיב). מותר להציע חדשה רק אם אין מתאימה. מכשיר — שם דגם בלי שם החברה אם החברה כבר בחברות (למשל "Galaxy A54").
פריט יכול להיות בכמה חברות/מכשירים/נושאים יחד. IMEI = 15 ספרות. טלפונים כמו שכתובים (03-1234567, *2000).`;

export async function POST(req) {
  if (!hasAI()) return Response.json({ error: 'no-ai' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  if (!(await member(req, body.shop))) return Response.json({ error: 'אין גישה' }, { status: 401 });
  const tags = tagList(body.tags);

  try {
    if (body.mode === 'organize') {
      const text = str(body.text, 8000);
      if (!text) return Response.json({ error: 'empty' }, { status: 400 });
      const out = await askJSON(`אתה מסדר מידע במאגר הידע של חנות טלפונים סלולריים בישראל. העובד כתב/הדביק את הטקסט הבא. סדר אותו לפריט אחד.
${ITEM_RULES}
התגיות הקיימות בחנות:
${tags}
החזר JSON בלבד: פריט אחד במבנה הנ"ל.
הטקסט:
"""${text}"""`);
      return Response.json({ item: fix(out) });
    }

    if (body.mode === 'image' || body.mode === 'imei') {
      const imgs = (Array.isArray(body.images) ? body.images : []).slice(0, 3)
        .filter((i) => /^image\/(jpeg|png|webp)$/.test(i?.mime) && typeof i.data === 'string' && i.data.length < 3_000_000)
        .map((i) => ({ mime: i.mime, data: i.data }));
      if (!imgs.length) return Response.json({ error: 'no image' }, { status: 400 });
      if (body.mode === 'imei') {
        const out = await askJSON(`בתמונה יש מדבקה/קופסה/מסך של טלפון סלולרי (למשל מסך *#06# או מדבקת IMEI).
מצא את כל מספרי ה-IMEI (15 ספרות, לפעמים כתוב IMEI1/IMEI2/MEID) ואת דגם המכשיר אם כתוב.
החזר JSON בלבד: {"imeis":["15 ספרות בלי רווחים"],"model":"","serial":""}. אל תמציא ספרות — אם לא קריא החזר רשימה ריקה.`, imgs);
        return Response.json({
          imeis: (Array.isArray(out.imeis) ? out.imeis : []).map((x) => String(x).replace(/\D/g, '')).filter((x) => x.length >= 14 && x.length <= 16).slice(0, 4),
          model: str(out.model, 80), serial: str(out.serial, 60),
        });
      }
      const out = await askJSON(`אתה מסדר מידע במאגר הידע של חנות טלפונים סלולריים בישראל. עובד צילם את התמונה (צילום מסך, כרטיס ביקור, שלט, מדבקה, מסמך, הודעה).
קרא את כל הטקסט החשוב בתמונה וסדר אותו לפריט אחד.
${ITEM_RULES}
${str(body.text, 2000) ? 'העובד הוסיף: ' + str(body.text, 2000) : ''}
התגיות הקיימות בחנות:
${tags}
החזר JSON בלבד: פריט אחד במבנה הנ"ל.`, imgs);
      return Response.json({ item: fix(out) });
    }

    if (body.mode === 'import') {
      const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(0, 80)
        .map((m) => ({ i: m.i | 0, text: str(m.text, 2000), at: str(m.at, 10) })).filter((m) => m.text);
      if (!msgs.length) return Response.json({ items: [] });
      const out = await askJSON(`אתה עובר על הודעות מצ'אט וואטסאפ שבו עובד בחנות טלפונים סלולריים בישראל רושם לעצמו מידע שימושי לעבודה
(קודים, IMEI, נקודות שירות, טלפונים, הוראות, מחירים, ספקים וכו').
הפוך את ההודעות לפריטי מידע מסודרים.
- דלג על הודעות שאינן מידע שימושי (שיחה, "אוקיי", תודה, תזכורות אישיות חסרות ערך, הודעה ריקה).
- כמה הודעות על אותו דבר — אחד לפריט אחד. הודעה עם כמה דברים שונים — פצל לכמה פריטים.
- אל תמציא. שמור את כל הפרטים.
${ITEM_RULES}
לכל פריט הוסף "src":[מספרי ההודעות (i) שהפריט נבנה מהן].
התגיות הקיימות בחנות:
${tags}
החזר JSON בלבד: {"items":[...]}
ההודעות (JSON):
${JSON.stringify(msgs)}`);
      const items = (Array.isArray(out.items) ? out.items : []).slice(0, 120).map((x) => ({
        ...fix(x), src: (Array.isArray(x.src) ? x.src : []).map((n) => n | 0).slice(0, 20),
      })).filter((x) => x.title || x.body);
      return Response.json({ items });
    }

    if (body.mode === 'ask') {
      const q = str(body.question, 500);
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 40).map((x) => ({
        id: str(x.id, 40), title: str(x.title, 200), tags: str(x.tags, 300), fields: x.fields && typeof x.fields === 'object' ? x.fields : {}, body: str(x.body, 1500),
      }));
      const out = await askJSON(`אתה עוזר לעובד בחנות טלפונים סלולריים בישראל. ענה על השאלה רק לפי פריטי המידע מהמאגר של החנות שמופיעים כאן.
אם אין במאגר תשובה — אמור זאת בפשטות ("לא מצאתי במאגר") ואפשר להוסיף בשורה נפרדת עצה כללית קצרה שמתחילה ב"באופן כללי:".
ענה קצר וברור בעברית, עם הפרטים המדויקים (קוד, טלפון, כתובת).
החזר JSON בלבד: {"answer":"התשובה","ids":["מזהי הפריטים שעליהם התשובה מבוססת"]}
השאלה: ${q}
הפריטים:
${JSON.stringify(items)}`);
      return Response.json({ answer: str(out.answer, 3000), ids: (Array.isArray(out.ids) ? out.ids : []).map((x) => str(x, 40)).slice(0, 10) });
    }
    return Response.json({ error: 'bad mode' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: 'ה-AI לא הצליח כרגע, נסה שוב', detail: String(e.message || e).slice(0, 120) }, { status: 502 });
  }
}

function fix(x) {
  const fields = {};
  const f = x?.fields && typeof x.fields === 'object' ? x.fields : {};
  for (const k of ALL_FIELDS) { const v = str(f[k], 300); if (v) fields[k] = v; }
  const arr = (a) => (Array.isArray(a) ? a.map((v) => str(v, 60)).filter(Boolean).slice(0, 8) : []);
  return {
    title: str(x?.title, 120),
    type: TYPES.some((t) => t.k === x?.type) ? x.type : 'note',
    body: str(x?.body, 8000),
    fields,
    companies: arr(x?.companies), devices: arr(x?.devices), topics: arr(x?.topics),
  };
}
