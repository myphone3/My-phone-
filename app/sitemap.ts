import type { MetadataRoute } from 'next';
import { SITE_URL, restSelect } from '@/lib/seo';
import { GUIDES } from '@/lib/guides';

// מפת אתר לגוגל: עמודים קבועים, מוצרים, קטגוריות, מותגים ומדריכים. מתעדכנת כל שעה.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, brands] = await Promise.all([
    restSelect('products?select=id,created_at&or=(is_published.is.null,is_published.eq.true)&order=created_at.desc', 3600),
    restSelect('categories?select=name', 3600),
    restSelect('brands?select=name', 3600),
  ]);
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly') => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    page('', 1, 'daily'),
    page('/catalog', 0.9, 'daily'),
    page('/categories', 0.8),
    page('/about', 0.5, 'monthly'),
    page('/quiz', 0.6, 'monthly'),
    page('/guide', 0.6, 'monthly'),
    ...GUIDES.map((g) => page(`/guide/${g.slug}`, 0.5, 'monthly')),
    ...categories.filter((c) => c?.name).map((c) => page(`/category/${encodeURIComponent(c.name)}`, 0.8)),
    ...brands.filter((b) => b?.name).map((b) => page(`/brand/${encodeURIComponent(b.name)}`, 0.6)),
    ...products.map((p) => ({
      url: `${SITE_URL}/product/${p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    page('/returns', 0.3, 'monthly'),
    page('/terms', 0.2, 'monthly'),
    page('/privacy', 0.2, 'monthly'),
    page('/accessibility', 0.2, 'monthly'),
  ];
}
