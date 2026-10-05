import './globals.css';
import ClientHeader from './components/ClientHeader';

// הגדרת מטא-דאטה לשם האפליקציה והלוגו בהוספה למסך הבית
export const metadata = {
  title: 'NEW PHONE - הפלאפון החדש שלך',
  description: 'החנות המובילה למכשירים כשרים, סלולר ונגנים',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NEW PHONE',
  },
  icons: {
    icon: '/Logo.JPG',
    apple: '/Logo.JPG',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        
        {/* הדר בקומפוננטת לקוח נפרדת */}
        <ClientHeader />

        <main className="min-h-screen">
          {children}
        </main>

        <footer className="bg-gray-900 text-white py-8 px-4 text-center text-xs space-y-2 mt-16">
          <p className="font-bold text-orange-400">NEW PHONE - כל הזכויות שמורות © 2026</p>
          <p className="text-gray-400">החנות המובילה למכשירים כשרים, סלולר ונגנים באיכות הגבוהה ביותר.</p>
        </footer>

      </body>
    </html>
  );
}
