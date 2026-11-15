import SharedRecipe from '@/components/SharedRecipe';

async function load(code) {
  if (!/^[a-z0-9]{6,16}$/i.test(code)) return null;
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/rc_get_share`, {
      method: 'POST',
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
      next: { revalidate: 3600 },
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const r = await load(params.code);
  if (!r) return { title: 'מתכון | מתכונים בגדול' };
  return {
    title: `${r.title} | מתכונים בגדול`,
    description: r.description || 'מתכון ששותף איתך — מצרכים ושלבים מסודרים',
    openGraph: { title: r.title, description: r.description || 'מתכון ששותף איתך', images: r.image_url ? [r.image_url] : [] },
  };
}

export default async function Page({ params }) {
  const recipe = await load(params.code);
  return <SharedRecipe recipe={recipe} />;
}
