import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const q = (searchParams.get('q') || '').trim();
  const city = (searchParams.get('city') || '').trim();

  try {
    if (type === 'street') {
      const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=1b16aacd-f8d9-493c-a1cb-cc2ecca0f98e&q=${encodeURIComponent(q)}&limit=100`);
      const data = await res.json();
      const records = data?.result?.records || [];
      
      const filtered = city 
        ? records.filter((r) => r.שם_ישוב?.trim() === city) 
        : records;

      const results = Array.from(new Set(filtered.map((r) => r.שם_רחוב?.trim()).filter(Boolean)));
      return NextResponse.json({ results: results.slice(0, 20) });
    }

    return NextResponse.json({ results: [] });
  } catch (err) {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
