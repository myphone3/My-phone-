import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Script from 'next/script';

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
      <head>
        <Script
          src="https://maps.googleapis.com/maps/api/js?key=AIzaSyD-fzkOn_MnGATKsLfCbQC3KaRgQmVlcso&libraries=places&language=he"
          strategy="beforeInteractive"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        
        {/* הדר ראשי */}
        <Header />

        <main className="min-h-screen">
          {children}
        </main>

        <Footer />

      </body>
    </html>
  );
}
