// גיבוי לשיתוף לאפליקציה של חנות מסוימת (כשה-service worker עוד לא פעיל): הטקסט עובר לדף "מידע חדש" של החנות
export async function POST(req, { params }) {
  const id = /^[0-9a-f-]{36}$/.test(params.id) ? params.id : '';
  let text = '';
  try {
    const form = await req.formData();
    text = [form.get('title'), form.get('text'), form.get('url')].filter((x) => typeof x === 'string' && x).join('\n');
  } catch {}
  return Response.redirect(new URL((id ? `/s/${id}` : '/') + '?add=' + encodeURIComponent(text.slice(0, 4000)), req.url), 303);
}
