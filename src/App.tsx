import React, { useEffect, useState, lazy, Suspense, useRef } from 'react';
import Cookies from 'js-cookie';
import { Category, Currency, Lang, Product, ProductRatingSummary, StoreSettings } from './types';
import { ar } from './i18n/ar';
import { en } from './i18n/en';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { SearchAndFilter } from './components/SearchAndFilter';
import { ProductCard } from './components/ProductCard';
import { HowItWorks } from './components/HowItWorks';
import { AuthorCard } from './components/AuthorCard';
import { GeneralFaq } from './components/GeneralFaq';
import { Footer } from './components/Footer';
import { ProductDetailsView } from './components/ProductDetailsView';
import { WaitlistModal } from './components/WaitlistModal';
import { CustomRequestModal } from './components/CustomRequestModal';
import { ProductSuggestionModal } from './components/ProductSuggestionModal';
import { AiShoppingAssistant } from './components/AiShoppingAssistant';
import { NotFound } from './components/NotFound';
import { SetupBanner } from './components/SetupBanner';
import { Wrench, Lightbulb, Bot, RotateCcw } from 'lucide-react';
import type { AdminTabType } from './components/admin/AdminLayout';

// Lazy load Admin components to keep public bundles small
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin').then(m => ({ default: m.AdminLogin })));
const ProductsList = lazy(() => import('./components/admin/ProductsList').then(m => ({ default: m.ProductsList })));
const ProductForm = lazy(() => import('./components/admin/ProductForm').then(m => ({ default: m.ProductForm })));
const CategoriesList = lazy(() => import('./components/admin/CategoriesList').then(m => ({ default: m.CategoriesList })));
const ReviewsList = lazy(() => import('./components/admin/ReviewsList').then(m => ({ default: m.ReviewsList })));
const SettingsForm = lazy(() => import('./components/admin/SettingsForm').then(m => ({ default: m.SettingsForm })));
const CustomRequestsList = lazy(() => import('./components/admin/CustomRequestsList').then(m => ({ default: m.CustomRequestsList })));
const ProductSuggestionsList = lazy(() => import('./components/admin/ProductSuggestionsList').then(m => ({ default: m.ProductSuggestionsList })));

import {
  fetchCategories,
  fetchProducts,
  fetchProductBySlug,
  fetchSettings,
  fetchAllApprovedRatingSummaries,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  updateStoreSettings
} from './lib/data-store';

import { supabase, isSupabaseConfigured, verifyAdminSession } from './lib/supabase';

export default function App() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    return <SetupBanner />;
  }

  // Navigation & URL Path parsing
  const [pathname, setPathname] = useState(window.location.pathname);
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  
  // App State
  const [lang, setLang] = useState<Lang>('ar');
  const [currency, setCurrency] = useState<Currency>('EGP');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ratingSummaries, setRatingSummaries] = useState<Record<string, ProductRatingSummary>>({});
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeWaitlistProduct, setActiveWaitlistProduct] = useState<Product | null>(null);
  const [isDetailsRoute, setIsDetailsRoute] = useState(false);
  
  // Search & Filter (Initialized from URL query params if present)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
  });

  // Evolution Feature Modals & Assistant Drawer State
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCustomRequestOpen, setIsCustomRequestOpen] = useState(false);
  const [customRequestPrefill, setCustomRequestPrefill] = useState<string | undefined>(undefined);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [suggestionPrefill, setSuggestionPrefill] = useState<string | undefined>(undefined);

  // Admin State
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTabType>('products');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [loading, setLoading] = useState(true);
  const isInitialSearchSyncRef = useRef(true);

  // Handle URL location changes (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setLocationSearch(window.location.search);
      const params = new URLSearchParams(window.location.search);
      setSearchQuery(params.get('q') || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Resolve ?category=<slug|id> once categories are loaded or when locationSearch changes
  useEffect(() => {
    if (categories.length === 0) return;
    const params = new URLSearchParams(locationSearch);
    const catParam = params.get('category');
    if (!catParam) {
      setSelectedCategoryId(null);
      return;
    }
    const matchedBySlug = categories.find(
      c => c.slug.toLowerCase() === catParam.toLowerCase()
    );
    if (matchedBySlug) {
      setSelectedCategoryId(matchedBySlug.id);
      return;
    }
    const numericId = Number(catParam);
    if (Number.isInteger(numericId)) {
      const matchedById = categories.find(c => c.id === numericId);
      setSelectedCategoryId(matchedById ? matchedById.id : null);
    }
  }, [categories, locationSearch]);

  // Debounced sync of searchQuery -> ?q= URL parameter (TASK-011)
  useEffect(() => {
    if (isInitialSearchSyncRef.current) {
      isInitialSearchSyncRef.current = false;
      return;
    }
    if (pathname.startsWith('/admin') || isDetailsRoute) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const trimmed = searchQuery.trim();
      if (trimmed) {
        params.set('q', trimmed);
      } else {
        params.delete('q');
      }
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
      setLocationSearch(nextSearch ? `?${nextSearch}` : '');
    }, 200);

    return () => window.clearTimeout(timer);
  }, [searchQuery, pathname, isDetailsRoute]);

  const handleSelectCategory = (categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
    if (pathname.startsWith('/admin') || isDetailsRoute) return;

    const params = new URLSearchParams(window.location.search);
    if (categoryId === null) {
      params.delete('category');
    } else {
      const catObj = categories.find(c => c.id === categoryId);
      params.set('category', catObj?.slug || String(categoryId));
    }
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.pushState({}, '', nextUrl);
    setLocationSearch(nextSearch ? `?${nextSearch}` : '');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('q');
    params.delete('category');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
    window.history.pushState({}, '', nextUrl);
    setLocationSearch(nextSearch ? `?${nextSearch}` : '');
  };

  // Parse path & redirects
  useEffect(() => {
    const path = pathname;

    // Root redirect to /ar
    if (path === '/' || path === '') {
      const target = `/ar${window.location.search || ''}`;
      window.history.replaceState({}, '', target);
      setPathname('/ar');
      setLang('ar');
      return;
    }

    if (path.startsWith('/en')) {
      setLang('en');
    } else if (path.startsWith('/ar')) {
      setLang('ar');
    }

    // Check currency cookie
    const savedCurrency = Cookies.get('enginity_currency') as Currency;
    if (savedCurrency === 'USD' || savedCurrency === 'EGP') {
      setCurrency(savedCurrency);
    }
  }, [pathname]);

  // Update HTML attributes for RTL/LTR
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Check active admin session in Supabase Auth & public.is_admin() / admins table (TASK-005)
  const checkAdminSession = async (): Promise<boolean> => {
    if (!supabase) return false;
    try {
      const { isAdmin, accessToken, userId } = await verifyAdminSession();
      if (!isAdmin || !accessToken) {
        if (userId) {
          // Signed in user is NOT an authorized admin — sign out immediately
          await supabase.auth.signOut();
          Cookies.remove('enginity_sb_token', { path: '/' });
          localStorage.removeItem('enginity_sb_token');
          setAdminAuthError('هذا الحساب غير مصرح له بصلاحيات المسؤول (Admin).');
        }
        return false;
      }

      Cookies.set('enginity_sb_token', accessToken, { expires: 7, path: '/' });
      localStorage.setItem('enginity_sb_token', accessToken);
      setAdminAuthError(null);
      return true;
    } catch {
      return false;
    }
  };

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const isUserAdmin = await checkAdminSession();
      setIsAdminAuth(isUserAdmin);

      const [cats, prods, sets] = await Promise.all([
        fetchCategories(),
        fetchProducts({ publishedOnly: !isUserAdmin }),
        fetchSettings()
      ]);
      setCategories(cats);
      setProducts(prods);
      setSettings(sets);

      if (prods.length > 0) {
        fetchAllApprovedRatingSummaries()
          .then(map => setRatingSummaries(map))
          .catch(() => {});
      }

      // Check if on Product Details page
      const detailsMatch = pathname.match(/^\/(ar|en)\/products\/([^\/]+)$/);
      if (detailsMatch) {
        setIsDetailsRoute(true);
        const slug = detailsMatch[2];
        const p = await fetchProductBySlug(slug, { publishedOnly: !isUserAdmin });
        setSelectedProduct(p);
      } else {
        setIsDetailsRoute(false);
        setSelectedProduct(null);
      }
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pathname]);

  const t = lang === 'ar' ? ar : en;

  // Toggle Language (preserving query parameters)
  const handleToggleLang = (newLang: Lang) => {
    setLang(newLang);
    let newPath = pathname;
    if (pathname.startsWith('/ar')) {
      newPath = pathname.replace('/ar', `/${newLang}`);
    } else if (pathname.startsWith('/en')) {
      newPath = pathname.replace('/en', `/${newLang}`);
    } else {
      newPath = `/${newLang}`;
    }
    const fullUrl = `${newPath}${window.location.search || ''}`;
    window.history.pushState({}, '', fullUrl);
    setPathname(newPath);
  };

  // Toggle Currency
  const handleToggleCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    Cookies.set('enginity_currency', newCurrency, { expires: 365, path: '/' });
  };

  // Admin Login Handler via Supabase Auth + verifyAdminSession (public.is_admin() / admins check)
  const handleAdminLogin = async (email: string, pass: string): Promise<boolean> => {
    if (!supabase) return false;
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });

      if (authErr || !authData?.user || !authData?.session) {
        return false;
      }

      const verification = await verifyAdminSession();
      if (!verification.isAdmin || !verification.accessToken) {
        await supabase.auth.signOut();
        Cookies.remove('enginity_sb_token', { path: '/' });
        localStorage.removeItem('enginity_sb_token');
        setAdminAuthError('هذا الحساب غير مدرج في قائمة مسؤولي النظام (public.admins).');
        return false;
      }

      // Store auth token in cookie and localStorage for server endpoints
      Cookies.set('enginity_sb_token', verification.accessToken, { expires: 7, path: '/' });
      localStorage.setItem('enginity_sb_token', verification.accessToken);

      setAdminAuthError(null);
      setIsAdminAuth(true);
      await loadData();
      return true;
    } catch {
      return false;
    }
  };

  const handleAdminLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    Cookies.remove('enginity_sb_token', { path: '/' });
    localStorage.removeItem('enginity_sb_token');
    setIsAdminAuth(false);
    window.location.href = '/ar';
  };

  // Upload image to Supabase Storage bucket product-media
  const handleUploadImage = async (file: File): Promise<string | null> => {
    if (!supabase) return null;
    try {
      const ext = file.name.split('.').pop();
      const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('product-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error || !data) {
        console.error('Storage upload error:', error);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-media')
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Image upload failed:', err);
      return null;
    }
  };

  // RENDER ADMIN PANEL
  if (pathname.startsWith('/admin')) {
    const adminFallback = (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-cairo text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-semibold text-slate-400">جاري تحميل لوحة التحكم...</div>
        </div>
      </div>
    );

    if (loading) {
      return adminFallback;
    }

    if (!isAdminAuth) {
      return (
        <Suspense fallback={adminFallback}>
          <AdminLogin onLogin={handleAdminLogin} initialError={adminAuthError} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={adminFallback}>
        <AdminLayout
          currentTab={adminTab}
          onSelectTab={tab => {
            setAdminTab(tab);
            setEditingProduct(null);
          }}
          onLogout={handleAdminLogout}
        >
          {adminTab === 'products' && (
            <ProductsList
              products={products}
              categories={categories}
              onAddNew={() => {
                setEditingProduct(null);
                setAdminTab('new-product');
              }}
              onEdit={prod => {
                setEditingProduct(prod);
                setAdminTab('edit-product');
              }}
              onDelete={async id => {
                await deleteProduct(id);
                loadData();
              }}
              onToggleStatus={async prod => {
                const newStatus = prod.status === 'published' ? 'draft' : 'published';
                await updateProduct(prod.id, { status: newStatus });
                loadData();
              }}
              onUpdateSortOrder={async (prod, newOrder) => {
                await updateProduct(prod.id, { sort_order: newOrder });
                loadData();
              }}
              onRefreshProducts={loadData}
            />
          )}

          {(adminTab === 'new-product' || adminTab === 'edit-product') && (
            <ProductForm
              initialProduct={editingProduct}
              categories={categories}
              onCancel={() => setAdminTab('products')}
              onUploadImage={handleUploadImage}
              onSave={async data => {
                let saved: Product | null = null;
                if (editingProduct) {
                  saved = await updateProduct(editingProduct.id, data);
                } else {
                  saved = await createProduct(data);
                }
                if (!saved) {
                  throw new Error('تعذّر حفظ بيانات المنتج. يرجى التأكد من البيانات والاتصال بالإنترنت.');
                }
                await loadData();
                setAdminTab('products');
              }}
            />
          )}

          {adminTab === 'categories' && (
            <CategoriesList
              categories={categories}
              onSaveCategory={async catData => {
                if (catData.id) {
                  await updateCategory(catData.id, catData);
                } else {
                  await createCategory(catData);
                }
                loadData();
              }}
              onDeleteCategory={async id => {
                await deleteCategory(id);
                loadData();
              }}
            />
          )}

          {adminTab === 'reviews' && <ReviewsList products={products} />}

          {adminTab === 'custom-requests' && <CustomRequestsList />}

          {adminTab === 'product-suggestions' && (
            <ProductSuggestionsList onProductCreated={loadData} />
          )}

          {adminTab === 'settings' && settings && (
            <SettingsForm
              settings={settings}
              onSaveSettings={async data => {
                await updateStoreSettings(data);
                loadData();
              }}
            />
          )}
        </AdminLayout>
      </Suspense>
    );
  }

  const handleOpenCustomRequestModal = (prefill?: string) => {
    setCustomRequestPrefill(prefill);
    setIsCustomRequestOpen(true);
  };

  const handleOpenProductSuggestionModal = (prefill?: string) => {
    setSuggestionPrefill(prefill);
    setIsSuggestionOpen(true);
  };

  const handleNavigateToProductSlug = (slug: string) => {
    const newPath = `/${lang}/products/${slug}`;
    window.history.pushState({}, '', newPath);
    setPathname(newPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // RENDER LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-cairo">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-semibold text-slate-500">جاري التحميل...</div>
        </div>
      </div>
    );
  }

  // RENDER 404 NOT FOUND FOR INVALID PRODUCT DETAILS ROUTE
  if (isDetailsRoute && !selectedProduct) {
    return (
      <div className="min-h-screen font-cairo flex flex-col justify-between">
        <Header
          lang={lang}
          currency={currency}
          t={t}
          onToggleLang={handleToggleLang}
          onToggleCurrency={handleToggleCurrency}
          whatsappNumber={settings?.whatsapp_number}
          whatsappMessage={settings?.whatsapp_default_message}
        />
        <NotFound lang={lang} t={t} />
        {settings && <Footer settings={settings} lang={lang} t={t} />}
      </div>
    );
  }

  // RENDER PUBLIC PRODUCT DETAILS VIEW
  if (selectedProduct) {
    const categoryName = categories.find(c => c.id === selectedProduct.category_id)?.[
      lang === 'ar' ? 'name_ar' : 'name_en'
    ];

    const related = products.filter(
      p => p.id !== selectedProduct.id && p.category_id === selectedProduct.category_id
    );

    return (
      <div className="min-h-screen font-cairo flex flex-col justify-between">
        <div>
          <Header
            lang={lang}
            currency={currency}
            t={t}
            onToggleLang={handleToggleLang}
            onToggleCurrency={handleToggleCurrency}
            whatsappNumber={settings?.whatsapp_number}
            whatsappMessage={settings?.whatsapp_default_message}
          />

          <ProductDetailsView
            product={selectedProduct}
            relatedProducts={related}
            settings={settings || ({} as StoreSettings)}
            currency={currency}
            lang={lang}
            t={t}
            categoryName={categoryName}
            onOpenWaitlist={prod => setActiveWaitlistProduct(prod)}
          />
        </div>

        {activeWaitlistProduct && (
          <WaitlistModal
            product={activeWaitlistProduct}
            lang={lang}
            t={t}
            onClose={() => setActiveWaitlistProduct(null)}
          />
        )}

        <CustomRequestModal
          isOpen={isCustomRequestOpen}
          onClose={() => setIsCustomRequestOpen(false)}
          lang={lang}
          prefillTopic={customRequestPrefill}
        />

        <ProductSuggestionModal
          isOpen={isSuggestionOpen}
          onClose={() => setIsSuggestionOpen(false)}
          lang={lang}
          prefillTopic={suggestionPrefill}
        />

        {settings && (
          <>
            <Footer
              settings={settings}
              lang={lang}
              t={t}
              onOpenAssistant={() => setIsAssistantOpen(true)}
              onOpenCustomRequest={() => handleOpenCustomRequestModal()}
              onOpenProductSuggestion={() => handleOpenProductSuggestionModal()}
            />
            <AiShoppingAssistant
              lang={lang}
              currency={currency}
              settings={settings}
              isOpen={isAssistantOpen}
              onToggleOpen={setIsAssistantOpen}
              onSelectProductSlug={handleNavigateToProductSlug}
              onOpenCustomRequest={handleOpenCustomRequestModal}
              onOpenProductSuggestion={handleOpenProductSuggestionModal}
            />
          </>
        )}
      </div>
    );
  }

  // RENDER PUBLIC HOME PAGE (/[lang])
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategoryId === null || p.category_id === selectedCategoryId;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name_ar.toLowerCase().includes(q) ||
      p.name_en.toLowerCase().includes(q) ||
      (p.short_ar && p.short_ar.toLowerCase().includes(q)) ||
      (p.short_en && p.short_en.toLowerCase().includes(q)) ||
      (p.tools && p.tools.some(tool => tool.toLowerCase().includes(q)));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen font-cairo flex flex-col justify-between">
      <div>
        <Header
          lang={lang}
          currency={currency}
          t={t}
          onToggleLang={handleToggleLang}
          onToggleCurrency={handleToggleCurrency}
          whatsappNumber={settings?.whatsapp_number}
          whatsappMessage={settings?.whatsapp_default_message}
        />

        <Hero
          t={t}
          lang={lang}
          onOpenAssistant={() => setIsAssistantOpen(true)}
          onOpenCustomRequest={() => handleOpenCustomRequestModal()}
          onOpenProductSuggestion={() => handleOpenProductSuggestionModal()}
        />

        {/* Search & Products Grid Section */}
        <section id="products" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 text-center">
          
          <div className="space-y-2 max-w-2xl mx-auto">
            <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
              {t.verifiedWorkflows}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {t.verifiedSubtitle}
            </p>
          </div>

          <SearchAndFilter
            categories={categories}
            selectedCategory={selectedCategoryId}
            searchQuery={searchQuery}
            lang={lang}
            t={t}
            onSelectCategory={handleSelectCategory}
            onSearchChange={setSearchQuery}
            onClearSearch={() => setSearchQuery('')}
            totalResultsCount={filteredProducts.length}
          />

          {/* Products Grid / Single Product Spotlight / Actionable Empty Filter State */}
          {filteredProducts.length === 0 ? (
            <div className="py-12 bg-white rounded-2xl border border-slate-200 text-slate-600 text-sm max-w-lg mx-auto shadow-xs space-y-5 p-6">
              <div className="space-y-1.5">
                <h3 className="font-heading font-extrabold text-base text-slate-900">
                  {t.noProductsFound}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'يمكنك إعادة ضبط الفلاتر لعرض جميع القوالب المتاحة، أو طلب تصميم نظام أتمتة مخصص لاحتياجك.'
                    : 'Reset filters to view all available workflows, or request a custom automation system tailored to your needs.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {(searchQuery.trim() !== '' || selectedCategoryId !== null) && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenCustomRequestModal(searchQuery.trim() || undefined)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2F6BFF] hover:bg-blue-600 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{t.customRequestBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenProductSuggestionModal(searchQuery.trim() || undefined)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>{t.suggestProductBtn}</span>
                </button>
              </div>
            </div>
          ) : filteredProducts.length === 1 ? (
            <div className="max-w-5xl mx-auto">
              <ProductCard
                key={filteredProducts[0].id}
                product={filteredProducts[0]}
                currency={currency}
                usdRate={settings?.usd_rate || 50}
                lang={lang}
                t={t}
                categoryName={categories.find(c => c.id === filteredProducts[0].category_id)?.[
                  lang === 'ar' ? 'name_ar' : 'name_en'
                ]}
                isSpotlight={true}
                onOpenWaitlist={prod => setActiveWaitlistProduct(prod)}
                ratingSummary={ratingSummaries[filteredProducts[0].id]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProducts.map(p => {
                const catName = categories.find(c => c.id === p.category_id)?.[
                  lang === 'ar' ? 'name_ar' : 'name_en'
                ];

                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    currency={currency}
                    usdRate={settings?.usd_rate || 50}
                    lang={lang}
                    t={t}
                    categoryName={catName}
                    onOpenWaitlist={prod => setActiveWaitlistProduct(prod)}
                    ratingSummary={ratingSummaries[p.id]}
                  />
                );
              })}
            </div>
          )}

          {/* Unified Customer Acquisition Bar: Custom Automation & Product Suggestion */}
          <div className="mt-12 rounded-2xl bg-[#0B1F3A] text-white p-6 sm:p-8 border border-slate-800 shadow-xl text-start">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-teal-300 text-xs font-bold">
                  <Bot className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'ar'
                      ? 'حلول أتمتة مفصلة على مقاس شركتك'
                      : 'Tailored Automation & Community Roadmap'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {lang === 'ar'
                    ? 'لم تجد القالب الجاهز المطابق لدورة عملك؟'
                    : "Didn't find the exact ready-made template for your workflow?"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {lang === 'ar'
                    ? 'يمكنك التحدث مع المساعد الذكي لترشيح الحل الأنسب، أو طلب بناء نظام أتمتة مخصص لشركتك، أو اقتراح قالب جديد لنضيفه إلى المتجر.'
                    : 'Consult our AI Shopping Advisor, request a custom-engineered automation system for your company, or suggest a new marketplace template.'}
                </p>
              </div>
              <div className="lg:col-span-5 flex flex-wrap items-center lg:justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenCustomRequestModal()}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#2F6BFF] hover:bg-blue-600 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Wrench className="w-4 h-4" />
                  <span>{t.customRequestBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenProductSuggestionModal()}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4" />
                  <span>{t.suggestProductBtn}</span>
                </button>
              </div>
            </div>
          </div>

        </section>

        <HowItWorks t={t} />

        {settings && <AuthorCard settings={settings} lang={lang} t={t} />}

        {settings && settings.general_faq && settings.general_faq.length > 0 && (
          <GeneralFaq faqs={settings.general_faq} lang={lang} t={t} />
        )}
      </div>

      {activeWaitlistProduct && (
        <WaitlistModal
          product={activeWaitlistProduct}
          lang={lang}
          t={t}
          onClose={() => setActiveWaitlistProduct(null)}
        />
      )}

      <CustomRequestModal
        isOpen={isCustomRequestOpen}
        onClose={() => setIsCustomRequestOpen(false)}
        lang={lang}
        prefillTopic={customRequestPrefill}
      />

      <ProductSuggestionModal
        isOpen={isSuggestionOpen}
        onClose={() => setIsSuggestionOpen(false)}
        lang={lang}
        prefillTopic={suggestionPrefill}
      />

      {settings && (
        <>
          <Footer
            settings={settings}
            lang={lang}
            t={t}
            onOpenAssistant={() => setIsAssistantOpen(true)}
            onOpenCustomRequest={() => handleOpenCustomRequestModal()}
            onOpenProductSuggestion={() => handleOpenProductSuggestionModal()}
          />
          <AiShoppingAssistant
            lang={lang}
            currency={currency}
            settings={settings}
            isOpen={isAssistantOpen}
            onToggleOpen={setIsAssistantOpen}
            onSelectProductSlug={handleNavigateToProductSlug}
            onOpenCustomRequest={handleOpenCustomRequestModal}
            onOpenProductSuggestion={handleOpenProductSuggestionModal}
          />
        </>
      )}
    </div>
  );
}
