import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// כותרת ותיאור לכל מותג (העמוד עצמו נטען בדפדפן)
type Props = { params: { name: string }; children: React.ReactNode };

export function generateMetadata({ params }: Props): Metadata {
  let name = params.name;
  try {
    name = decodeURIComponent(params.name);
  } catch {
    // שם לא תקין בכתובת
  }
  const title = `${name} | ${SITE_NAME}`;
  const description = `כל המוצרים של ${name} ב-NEW PHONE: מחירים, השוואה, משלוח עד הבית ושירות אישי בוואטסאפ.`;
  const url = `${SITE_URL}/brand/${encodeURIComponent(name)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, siteName: SITE_NAME, locale: 'he_IL' },
  };
}

export default function Layout({ children }: Props) {
  return children;
}
