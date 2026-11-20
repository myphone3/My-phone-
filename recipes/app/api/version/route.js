// הגרסה שעלתה לאוויר — הטלוויזיה בודקת מדי פעם ומתרעננת כשיש חדשה
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD || '' }, { headers: { 'Cache-Control': 'no-store' } });
}
