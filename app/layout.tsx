import './globals.css';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ToastHost from '../components/Toast';
import WhatsAppFloat from '../components/WhatsAppFloat';
import Script from 'next/script';
import type { Metadata } from 'next';
import Analytics from '../components/Analytics';
import CampaignTracker from '../components/CampaignTracker';
import CartSync from '../components/CartSync';
import SiteTracker from '../components/SiteTracker';
import ConsentBanner from '../components/ConsentBanner';
import AssistantFloat from '../components/AssistantFloat';
import { Suspense } from 'react';
import { getSiteSettings } from '@/lib/siteSettings';

// מטא-דאטה: שם האפליקציה והלוגו, וכותרת/תיאור/אימות גוגל מהגדרות ה-SEO בפאנל
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const icon = settings.favicon_url || '/Logo.JPG';
  return {
    title: settings.meta_title?.trim() || 'NEW PHONE - הפלאפון החדש שלך',
    description: settings.meta_description?.trim() || 'החנות המובילה למכשירים כשרים, סלולר ונגנים',
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'NEW PHONE',
    },
    icons: {
      icon,
      apple: '/Logo.JPG',
    },
    verification: settings.google_site_verification ? { google: settings.google_site_verification } : undefined,
  };
}

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
        <ToastHost />
        <WhatsAppFloat />
        <Analytics />
        <Suspense fallback={null}>
          <CampaignTracker />
        </Suspense>
        <CartSync />
        <SiteTracker />
        <AssistantFloat />
        <ConsentBanner />

      </body>
    </html>
  );
}
