import './globals.css';
import StoreHeader from '@/components/StoreHeader';

export const metadata = {
  title: 'חנות סלולר',
  description: 'חנות טכנולוגיה וסלולר',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {/* התפריט העליון של החנות כולל פעמון ההתראות */}
        <StoreHeader />
        
        {/* תוכן העמודים באתר */}
        <main>{children}</main>
      </body>
    </html>
  );
}
