import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL, effectivePrice, firstImage, jsonLdString, plainText, restSelect } from '@/lib/seo';

// כותרת, תיאור, תמונה לשיתוף ונתונים מובנים לכל מוצר (העמוד עצמו נטען בדפדפן, ולכן המידע לגוגל נוצר כאן בשרת)
type Props = { params: { id: string }; children: React.ReactNode };

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function getProduct(id: string) {
  if (!isUuid(id)) return null;
  const rows = await restSelect(
    `products?id=eq.${id}&select=id,name,description,price,sale_price,image_url,images,brand,category,stock,is_published&limit=1`
  );
  const p = rows[0];
  if (!p || p.is_published === false) return null;
  return p;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct(params.id);
  if (!p) return { title: `מוצר | ${SITE_NAME}` };
  const price = effectivePrice(p);
  const title = `${p.name} | ${SITE_NAME}`;
  const description =
    plainText(p.description, 150) ||
    `${p.name}${p.brand ? ` של ${p.brand}` : ''} ב-₪${price}. משלוח עד הבית, אחריות יבואן ושירות אישי בוואטסאפ.`;
  const image = firstImage(p);
  const url = `${SITE_URL}/product/${p.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: SITE_NAME,
      locale: 'he_IL',
      images: image ? [{ url: image, alt: p.name }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function ProductLayout({ params, children }: Props) {
  const p = await getProduct(params.id);
  const jsonLd = p
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name,
          image: firstImage(p) ? [firstImage(p)] : undefined,
          description: plainText(p.description, 500) || undefined,
          brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
          category: p.category || undefined,
          offers: {
            '@type': 'Offer',
            url: `${SITE_URL}/product/${p.id}`,
            priceCurrency: 'ILS',
            price: effectivePrice(p),
            availability:
              p.stock !== null && p.stock !== undefined && p.stock !== '' && Number(p.stock) <= 0
                ? 'https://schema.org/OutOfStock'
                : 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: SITE_NAME },
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'דף הבית', item: SITE_URL },
            ...(p.category
              ? [{ '@type': 'ListItem', position: 2, name: p.category, item: `${SITE_URL}/category/${encodeURIComponent(p.category)}` }]
              : []),
            { '@type': 'ListItem', position: p.category ? 3 : 2, name: p.name },
          ],
        },
      ]
    : null;
  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />}
      {children}
    </>
  );
}
