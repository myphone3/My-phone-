// לכל חנות: קובץ התקנה, אייקון ושם משלה (כשמוסיפים למסך הבית מתוך החנות)
import { getBrand, iconUrl, appName } from '@/lib/brand';

export async function generateMetadata({ params }) {
  const b = await getBrand(params.id);
  if (!b) return {};
  const n = appName(b.name);
  return {
    title: n.name,
    manifest: `/api/manifest/${params.id}`,
    icons: { icon: [{ url: iconUrl(params.id, b.logo, 192), sizes: '192x192', type: 'image/png' }], apple: iconUrl(params.id, b.logo, 180) },
    appleWebApp: { capable: true, title: n.short, statusBarStyle: 'default' },
  };
}

export default function ShopLayout({ children }) {
  return children;
}
