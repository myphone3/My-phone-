// גיבוי: אם ה-service worker עוד לא פעיל, השיתוף מגיע לכאן. טקסט עובר לדף "מידע חדש".
export async function POST(req) {
  let text = '';
  try {
    const form = await req.formData();
    text = [form.get('title'), form.get('text'), form.get('url')].filter((x) => typeof x === 'string' && x).join('\n');
  } catch {}
  return Response.redirect(new URL('/?add=' + encodeURIComponent(text.slice(0, 4000)), req.url), 303);
}
