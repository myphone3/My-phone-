import './globals.css';
import StoreHeader from './StoreHeader';

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
        <StoreHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
