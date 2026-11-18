// האייקון של חנות: הלוגו שלה על ריבוע לבן. m=1 = גרסה עם שוליים רחבים (אנדרואיד חותך לעיגול/צורות)
import { ImageResponse } from 'next/og';
import { getBrand, SHOP_ID } from '@/lib/brand';

export async function GET(req, { params }) {
  const url = new URL(req.url);
  const size = Math.min(1024, Math.max(48, parseInt(url.searchParams.get('s'), 10) || 512));
  const mask = url.searchParams.get('m') === '1';
  const b = SHOP_ID.test(params.id) ? await getBrand(params.id) : null;
  if (!b?.logo) return Response.redirect(new URL(mask ? '/icon-maskable-512.png' : size <= 192 ? '/icon-192.png' : '/icon-512.png', req.url), 302);
  const src = new URL(b.logo, req.url).toString();
  const box = Math.round(size * (mask ? 0.72 : 0.88));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff' }}>
        <img src={src} width={box} height={box} style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800' } },
  );
}
