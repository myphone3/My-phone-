'use client';

import { useEffect, useState } from 'react';
import { supabase, Product } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

type ProductForm = {
  id?: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  stock: string;
  description: string;
  image_url: string;
  spec_storage: string;
  spec_ram: string;
  spec_battery: string;
};

const emptyForm: ProductForm = {
  name: '',
  brand: '',
  category: '',
  price: '',
  stock: '',
  description: '',
  image_url: '',
  spec_storage: '',
  spec_ram: '',
  spec_battery: '',
};

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<'products' | 'settings'>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [saving, setSaving] = useState(false);

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchProducts();
      fetchSettings();
    }
  }, [session]);

  async function fetchProducts() {
    setLoadingProducts(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data ?? []);
    setLoadingProducts(false);
  }

  async function fetchSettings() {
    const { data } = await supabase.from('site_settings').select('key, value');
    const map: Record<string, string> = {};
    (data ?? []).forEach((row) => {
      map[row.key] = row.value ?? '';
    });
    setSettings(map);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('אימייל או סיסמה שגויים');
    setLoggingIn(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function openNewProduct() {
    setForm({ ...emptyForm });
  }

  function openEditProduct(p: Product) {
    setForm({
      id: p.id,
      name: p.name ?? '',
      brand: p.brand ?? '',
      category: p.category ?? '',
      price: String(p.price ?? ''),
      stock: String(p.stock ?? ''),
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      spec_storage: p.spec_storage ?? '',
      spec_ram: p.spec_ram ?? '',
      spec_battery: p.spec_battery ?? '',
    });
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);

    const payload = {
      name: form.name,
      brand: form.brand,
      category: form.category,
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      description: form.description,
      image_url: form.image_url,
      spec_storage: form.spec_storage,
      spec_ram: form.spec_ram,
      spec_battery: form.spec_battery,
    };

    if (form.id) {
      await supabase.from('products').update(payload).eq('id', form.id);
    } else {
      await supabase.from('products').insert(payload);
    }

    setSaving(false);
    setForm(null);
    fetchProducts();
  }

  async function handleDeleteProduct(id: string) {
    if (!confirm('למחוק את המוצר הזה?')) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    const entries = Object.entries(settings);
    for (const [key, value] of entries) {
      await supabase.from('site_settings').upsert({ key, value });
    }
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }

  if (checkingSession) {
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-muted">טוען...</div>;
  }

  if (!session) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="font-display font-bold text-2xl mb-6 text-center">כניסת מנהל</h1>
        <form onSubmit={handleLogin} className="bg-panel border border-line rounded-card p-5 space-y-3">
          <input
            type="email"
            placeholder="אימייל"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            placeholder="סיסמה"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
          />
          {loginError && <p className="text-signal text-sm">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full bg-ink text-white font-medium py-2.5 rounded-card hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loggingIn ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">ניהול החנות</h1>
        <button onClick={handleLogout} className="text-sm text-muted hover:text-signal">
          התנתק
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-line">
        <button
          onClick={() => setTab('products')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'products' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
        >
          מוצרים
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'settings' ? 'border-accent text-accent' : 'border-transparent text-muted'
          }`}
        >
          עיצוב האתר
        </button>
      </div>

      {tab === 'products' && (
        <div>
          {!form && (
            <button
              onClick={openNewProduct}
              className="mb-4 bg-ink text-white text-sm font-medium px-4 py-2 rounded-card hover:bg-accent transition-colors"
            >
              + מוצר חדש
            </button>
          )}

          {form && (
            <form onSubmit={handleSaveProduct} className="bg-panel border border-line rounded-card p-4 mb-6 space-y-3">
              <h2 className="font-display font-bold">{form.id ? 'עריכת מוצר' : 'מוצר חדש'}</h2>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="שם המוצר" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="col-span-2 border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input placeholder="מותג" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input placeholder="קטגוריה" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input type="number" placeholder="מחיר" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input type="number" placeholder="מלאי" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input placeholder="קישור לתמונה" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="col-span-2 border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <textarea placeholder="תיאור" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="col-span-2 border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" rows={2} />
                <input placeholder="אחסון (למשל 128GB)" value={form.spec_storage} onChange={(e) => setForm({ ...form, spec_storage: e.target.value })} className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input placeholder="זיכרון RAM" value={form.spec_ram} onChange={(e) => setForm({ ...form, spec_ram: e.target.value })} className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
                <input placeholder="סוללה" value={form.spec_battery} onChange={(e) => setForm({ ...form, spec_battery: e.target.value })} className="border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-card hover:bg-accent transition-colors disabled:opacity-50">
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button type="button" onClick={() => setForm(null)} className="text-sm text-muted px-4 py-2">
                  ביטול
                </button>
              </div>
            </form>
          )}

          {loadingProducts ? (
            <p className="text-muted text-sm">טוען מוצרים...</p>
          ) : (
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-panel border border-line rounded-card p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{p.name}</p>
                    <p className="spec-num text-xs text-muted">₪{p.price} · מלאי: {p.stock}</p>
                  </div>
                  <div className="flex gap-3 shrink-0 text-sm">
                    <button onClick={() => openEditProduct(p)} className="text-accent hover:underline">ערוך</button>
                    <button onClick={() => handleDeleteProduct(p.id)} className="text-signal hover:underline">מחק</button>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className="text-muted text-sm">אין עדיין מוצרים</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-panel border border-line rounded-card p-4 space-y-4 max-w-lg">
          <div>
            <label className="text-sm text-muted block mb-1">כותרת ראשית - שורה 1</label>
            <input
              value={settings.hero_title_line1 ?? ''}
              onChange={(e) => setSettings({ ...settings, hero_title_line1: e.target.value })}
              className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">כותרת ראשית - שורה מודגשת (בצבע)</label>
            <input
              value={settings.hero_title_accent ?? ''}
              onChange={(e) => setSettings({ ...settings, hero_title_accent: e.target.value })}
              className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1">תת-כותרת</label>
            <textarea
              value={settings.hero_subtitle ?? ''}
              onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
              rows={3}
              className="w-full border border-line rounded-card px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            type="submit"
            disabled={savingSettings}
            className="bg-ink text-white text-sm font-medium px-4 py-2 rounded-card hover:bg-accent transition-colors disabled:opacity-50"
          >
            {settingsSaved ? 'נשמר ✓' : savingSettings ? 'שומר...' : 'שמור שינויים'}
          </button>
        </form>
      )}
    </div>
  );
}
