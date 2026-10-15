import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'city' או 'street'
  const query = searchParams.get('q') || '';
  const cityName = searchParams.get('city') || '';

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    if (type === 'city') {
      // מזהה משאב רשמי של יישובים בישראל מתוך data.gov.il
      const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=5c70e413-2105-471f-ab91-8f78ff7fc35f&q=${encodeURIComponent(query.trim())}&limit=10`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data?.result?.records) {
        const cities = Array.from(new Set(data.result.records.map(r => r['שם_ישוב']?.trim()))).filter(Boolean);
        return NextResponse.json({ results: cities });
      }
    } else if (type === 'street') {
      // מזהה משאב רשמי של רחובות בישראל מתוך data.gov.il
      const searchTerm = cityName ? `${cityName} ${query.trim()}` : query.trim();
      const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=a70b0d10-8b1e-4320-9418-872376f5a373&q=${encodeURIComponent(searchTerm)}&limit=15`;
      const response = await fetch(url);
      const data = await response.json();

      if (data?.result?.records) {
        // סינון רחובות ששייכים לעיר הנבחרת במידה וסופקה
        let records = data.result.records;
        if (cityName) {
          records = records.filter(r => r['שם_ישוב']?.trim() === cityName.trim());
        }
        const streets = Array.from(new Set(records.map(r => r['שם_רחוב']?.trim()))).filter(Boolean);
        return NextResponse.json({ results: streets });
      }
    }

    return NextResponse.json({ results: [] });
  } catch (error) {
    console.error('Error fetching addresses from Gov API:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
