import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const q = searchParams.get('q') || '';
  const city = searchParams.get('city') || '';

  try {
    if (type === 'city') {
      const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=9ad3862c-8391-4b2f-84a4-24c465ff64ec&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const records = data?.result?.records || [];
      const results = Array.from(new Set(records.map((r) => r.שם_ישוב?.trim()).filter(Boolean)));
      return NextResponse.json({ results: results.slice(0, 10) });
    } 
    
    if (type === 'street') {
      const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=1b16aacd-f8d9-493c-a1cb-cc2ecca0f98e&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const records = data?.result?.records || [];
      const filtered = city ? records.filter((r) => r.שם_ישוב?.trim() === city.trim()) : records;
      const results = Array.from(new Set(filtered.map((r) => r.שם_רחוב?.trim()).filter(Boolean)));
      return NextResponse.json({ results: results.slice(0, 10) });
    }

    return NextResponse.json({ results: [] });
  } catch (err) {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
