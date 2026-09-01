'use client';

import './globals.css';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{ text: string; endTime?: string } | null>({
    text: '🚚 משלוח מהיר עד הבית | מבצעי ענק על מכשירים כשרים וסלולר!',
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({ hours: 0, minutes: 0, seconds: 0 });
  
  const [notifications, setNotifications] = useState<string[]>([
    'ההזמנה שלך נקלטה בהצלחה! 📦',
    'מוצרים חדשים הגיעו לחנות 🔥'
  ]);

  const adminEmails = [
    'daniel@example.com',
    'd0587223040@gmail.com',
    'd0556771356@gmail.com'
  ];

  const isAdmin = user && (adminEmails.includes(user.email) || user.email?.includes('admin'));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    fetchSettings();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('settings').select('*').single();
      if (data && data.announcement_text) {
        setAnnouncement({
          text: data.announcement_text,
          endTime: data.announcement_end_time
        });
      }
    } catch (err) {}
  };

  useEffect(() => {
    if (!announcement?.endTime) return;

    const timer = setInterval(() => {
      const difference = new Date(announcement.endTime!).getTime() - new Date().getTime();
      if (difference > 0) {
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        setTimeLeft({ hours, minutes, seconds });
      } else {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [announcement?.endTime]);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDropdownOpen(false);
    window.location.reload();
  };

  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen text-gray-900">
        
        {announcement && (
          <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 text-white text-[11px] font-bold py-1 px-4 flex items-center justify-between shadow-xs overflow-hidden">
            <div className="truncate flex-1 text-center sm:text-right">
              <span>{announcement.text}</span>
            </div>
            {announcement.endTime && (
              <div className="bg-black/25 backdrop-blur-sm px-2 py-0.5 rounded-md flex items-center gap-1 text-[10px] shrink-0 mr-3">
                <span>⏱️</span>
                <span className="font-black">{String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}</span>
              </div>
            )}
          </div>
        )}

        <header className="bg-white border-b sticky top-0 z-40 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 h-20 sm:h-24 flex items-center justify-between">
            <Link href="/" className="flex items-center cursor-pointer group py-1">
              <img src="/Logo.JPG" alt="NEW PHONE" className="h-16 sm:h-20 w-auto object-contain group-hover:scale-105 transition duration-300 drop-shadow-sm" />
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/cart"
                className="relative bg-orange-600 hover:bg-orange-700 text-white p-2.5 rounded-xl transition flex items-center justify-center shadow-sm cursor-pointer"
                title="עגלת קניות"
              >
                🛒
              </Link>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="relative flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-2xl shadow-2xs hover:bg-gray-100 transition cursor-pointer"
                  >
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="w-7 h-7 rounded-full object-cover border"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">
                        {user.email?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-bold hidden sm:inline max-w-[100px] truncate">
                      {user.user_metadata?.full_name || user.email?.split('@')[0]}
                    </span>

                    {notifications.length > 0 && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                    )}
                  </button>

                  {dropdownOpen && (
                    <div className="absolute left-0 mt-2 w-72 bg-white border rounded-2xl shadow-xl p-3 z-50 space-y-3">
                      <div className="px-2 py-1 border-b text-xs font-bold text-gray-700 flex justify-between items-center">
                        <span>חשבון משתמש</span>
                        <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{user.email}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[11px] font-black text-gray-400 px-1">התראות ועדכונים 🔔</div>
                        {notifications.length === 0 ? (
                          <div className="text-xs text-gray-500 px-2 py-1">אין התראות חדשות</div>
                        ) : (
                          notifications.map((notif, idx) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded-xl text-xs text-gray-800 border border-gray-100">
                              {notif}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="border-t pt-2">
                        <button
                          onClick={handleLogout}
                          className="w-full text-right text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer"
                        >
                          <span>התנתקות מהמערכת</span>
                          <span>🚪</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.13 0-5.78-2.11-6.73-4.96H1.18v3.15C3.15 21.3 7.23 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.18C.43 8.13 0 9.87 0 11.76s.43 3.63 1.18 5.15l4.09-2.67z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.7 1.18 6.61l4.09 3.15c.95-2.85 3.6-4.96 6.73-4.96z"/>
                  </svg>
                  <span className="hidden sm:inline">התחברות</span>
                </button>
              )}

              {isAdmin && (
                <Link
                  href="/admin/products"
                  className="bg-orange-600 text-white hover:bg-orange-700 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-2xs"
                >
                  ⚙️ ניהול
                </Link>
              )}
            </div>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
