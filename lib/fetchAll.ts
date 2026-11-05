// Supabase מחזיר עד 1,000 שורות בבקשה; זה טוען את כל השורות בדפים
export async function fetchAll<T = any>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) return { data: all, error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) return { data: all, error: null };
  }
}
