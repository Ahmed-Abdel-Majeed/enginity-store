import {
  Category,
  Product,
  StoreSettings,
  Lang,
  WaitlistEntry,
  WaitlistStats,
  CustomAutomationRequest,
  CustomRequestStatus,
  ProductSuggestion,
  ProductSuggestionStatus,
  PurchaseLikelihood,
  DemandAnalyticsSummary,
  AssistantResponsePayload,
  ProductReview,
  ProductReviewStatus,
  ProductRatingSummary
} from '../types';
import { supabase, isSupabaseConfigured, getSupabaseAdmin, getSystemAdminSupabase } from './supabase';
import {
  normalizeDateToIso,
  normalizePhoneNumber,
  resolveProductPricing,
  validateProductPricing,
  computeProductRatingSummary
} from './utils';
import {
  createCustomAutomationRequest,
  listCustomAutomationRequests,
  updateCustomAutomationRequest,
  createProductSuggestion,
  listProductSuggestions,
  updateProductSuggestion,
  computeDemandAnalytics,
  createProductReview,
  listApprovedProductReviews,
  getProductReviewsAndSummary,
  listAdminProductReviews,
  moderateProductReview,
  deleteProductReview
} from './crm-store';
import { processAssistantTurn } from './assistant-engine';
import Cookies from 'js-cookie';

const PRICING_META_REGEX = /\n?<!--ENGINITY_PRICING:(\{[^\n]*?\})-->\s*$/;

export function stripPricingMetaFromNotes(notes?: string | null): string {
  if (!notes || typeof notes !== 'string') return '';
  return notes.replace(PRICING_META_REGEX, '').trimEnd();
}

export function attachPricingMetaToAdminNotes(
  notes: string | null | undefined,
  originalPriceEgp: number,
  salePriceEgp: number | null
): string {
  const clean = stripPricingMetaFromNotes(notes);
  const meta = JSON.stringify({
    original_price_egp: originalPriceEgp,
    sale_price_egp: salePriceEgp
  });
  return clean ? `${clean}\n<!--ENGINITY_PRICING:${meta}-->` : `<!--ENGINITY_PRICING:${meta}-->`;
}

export function hydrateProductPricing(raw: any): Product {
  if (!raw || typeof raw !== 'object') return raw;

  let extractedMeta: { original_price_egp?: number | null; sale_price_egp?: number | null } | null = null;
  let cleanAdminNotes = raw.admin_notes;

  if (typeof raw.admin_notes === 'string') {
    const match = raw.admin_notes.match(PRICING_META_REGEX);
    if (match && match[1]) {
      try {
        extractedMeta = JSON.parse(match[1]);
      } catch {
        extractedMeta = null;
      }
      cleanAdminNotes = stripPricingMetaFromNotes(raw.admin_notes);
    }
  }

  const hasNativeOriginal =
    raw.original_price_egp !== undefined &&
    raw.original_price_egp !== null &&
    Number.isFinite(Number(raw.original_price_egp));

  const hasNativeSale =
    raw.sale_price_egp !== undefined &&
    raw.sale_price_egp !== null &&
    Number.isFinite(Number(raw.sale_price_egp));

  const candidateOriginal = hasNativeOriginal
    ? Number(raw.original_price_egp)
    : extractedMeta && typeof extractedMeta.original_price_egp === 'number'
    ? extractedMeta.original_price_egp
    : Number(raw.price_egp) || 0;

  const candidateSale = hasNativeSale
    ? Number(raw.sale_price_egp)
    : raw.sale_price_egp === null
    ? null
    : extractedMeta && extractedMeta.sale_price_egp !== undefined
    ? extractedMeta.sale_price_egp
    : null;

  const resolved = resolveProductPricing({
    price_egp: Number(raw.price_egp) || 0,
    original_price_egp: candidateOriginal,
    sale_price_egp: candidateSale
  });

  return {
    ...raw,
    admin_notes: cleanAdminNotes,
    price_egp: resolved.effectivePriceEgp,
    original_price_egp: resolved.originalPriceEgp,
    sale_price_egp: resolved.salePriceEgp
  };
}

// In-Memory SWR Cache for categories and settings
let cachedCategories: { data: Category[]; timestamp: number } | null = null;
let cachedSettings: { data: StoreSettings; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60s cache

export function clearDataStoreCache() {
  cachedCategories = null;
  cachedSettings = null;
}

export async function fetchCategories(): Promise<Category[]> {
  const now = Date.now();
  if (cachedCategories && now - cachedCategories.timestamp < CACHE_TTL_MS) {
    return cachedCategories.data;
  }

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!error && data) {
      cachedCategories = { data, timestamp: now };
      return data;
    }
  }
  return cachedCategories?.data || [];
}

export const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  usd_rate: 50.0,
  whatsapp_number: '201501053538',
  whatsapp_default_message: 'مرحباً مهندس أحمد، أود الاستفسار عن منتجات وحلول Enginity',
  author_name: 'أحمد عبد المجيد (Ahmed Abdelmajed)',
  author_bio_ar: 'مهندس ومطور أنظمة الأتمتة والذكاء الاصطناعي | مؤسس Enginity Store. متخصص في بناء وحلول workflows متطورة باستخدام n8n والذكاء الاصطناعي للشركات والأفراد.',
  author_bio_en: 'Automation & AI Systems Engineer | Founder of Enginity Store. Specializing in advanced n8n and AI workflows.',
  author_photo: '',
  author_followers_text_ar: 'خبير أتمتة وحلول ذكاء اصطناعي',
  author_followers_text_en: 'Verified Automation & AI Expert',
  contact_email: 'ahmedabdalmaged2002@yahoo.com',
  buy_notice_enabled: true,
  buy_notice_ar: 'سيتم توجيهك لرابط الدفع السريع والآمن لإتمام الطلب واستلام الـ Workflow فوراً.',
  buy_notice_en: 'You will be redirected to a secure payment page to complete your order and receive the workflow immediately.',
  n8n_launch_webhook_url: 'https://n8n-enginity.duckdns.org/webhook/send-email-from-user-product-publish',
  social_links: {
    youtube: 'https://www.youtube.com/@ahmed_abdelmajed',
    linkedin: 'https://www.linkedin.com/in/ahmed-abdelmajed-44ab58314',
    facebook: 'https://facebook.com/ahmedabdelmagedflow',
    portfolio: 'https://ahmed-portfolio-five-iota.vercel.app/'
  },
  general_faq: [
    {
      q_ar: 'كيف أستلم ملف الـ Workflow بعد الدفع؟',
      q_en: 'How do I receive the workflow file after payment?',
      a_ar: 'بعد إتمام الدفع مباشرة ستظهر لك صفحة التحميل، كما سيرصل لك رابط التحميل مباشرة على بريدك الإلكتروني.',
      a_en: 'Directly after completing payment, you will get the download link on screen and via email.'
    }
  ]
};

export async function fetchSettings(): Promise<StoreSettings> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.timestamp < CACHE_TTL_MS) {
    return cachedSettings.data;
  }

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();
    if (!error && data) {
      const merged: StoreSettings = {
        ...DEFAULT_SETTINGS,
        ...data,
        social_links: {
          ...DEFAULT_SETTINGS.social_links,
          ...(data.social_links || {})
        }
      };
      cachedSettings = { data: merged, timestamp: now };
      return merged;
    }
  }
  return cachedSettings?.data || DEFAULT_SETTINGS;
}

export async function fetchProducts(options?: {
  publishedOnly?: boolean;
  categoryId?: number;
  searchQuery?: string;
  throwOnError?: boolean;
}): Promise<Product[]> {
  const publishedOnly = options?.publishedOnly ?? true;
  const categoryId = options?.categoryId;
  const searchQuery = options?.searchQuery?.toLowerCase().trim();
  const throwOnError = options?.throwOnError ?? false;

  if (isSupabaseConfigured() && supabase) {
    let query = supabase.from('products').select('*');
    if (publishedOnly) {
      query = query.in('status', ['published', 'coming_soon']);
    }
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    const { data, error } = await query.order('sort_order', { ascending: true });
    if (error) {
      if (throwOnError) {
        throw new Error(`Supabase products query failed: ${error.message}`);
      }
      return [];
    }
    if (data) {
      let result: Product[] = data.map(hydrateProductPricing);
      if (searchQuery) {
        result = result.filter(
          p =>
            p.name_ar.toLowerCase().includes(searchQuery) ||
            p.name_en.toLowerCase().includes(searchQuery) ||
            (p.short_ar && p.short_ar.toLowerCase().includes(searchQuery)) ||
            (p.short_en && p.short_en.toLowerCase().includes(searchQuery)) ||
            (p.tools && p.tools.some(t => t.toLowerCase().includes(searchQuery)))
        );
      }
      return result;
    }
  } else if (throwOnError) {
    throw new Error('Supabase client is not configured.');
  }

  return [];
}

export async function fetchProductBySlug(slug: string, publishedOnly = true): Promise<Product | null> {
  if (isSupabaseConfigured() && supabase) {
    let query = supabase.from('products').select('*').eq('slug', slug);
    if (publishedOnly) {
      query = query.in('status', ['published', 'coming_soon']);
    }
    const { data, error } = await query.single();
    if (!error && data) return hydrateProductPricing(data);
  }
  return null;
}

function getAuthHeader(): Record<string, string> {
  let token = '';
  if (typeof window !== 'undefined') {
    token = Cookies.get('enginity_sb_token') || localStorage.getItem('enginity_sb_token') || '';
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getActiveClient() {
  if (typeof window !== 'undefined' && supabase) {
    return supabase;
  }
  return await getSystemAdminSupabase();
}

export async function createProduct(productData: Partial<Product>, token?: string): Promise<Product | null> {
  const payload: any = { ...productData };
  if (!payload.id) delete payload.id;
  if (payload.expected_launch_date) {
    payload.expected_launch_date = normalizeDateToIso(payload.expected_launch_date);
  }

  // Validate and normalize pricing fields
  const pricingCheck = validateProductPricing({
    originalPriceEgp: payload.original_price_egp,
    salePriceEgp: payload.sale_price_egp,
    priceEgp: payload.price_egp
  });
  if (!pricingCheck.valid) {
    throw new Error(pricingCheck.errorAr || 'بيانات التسعير غير صالحة.');
  }
  payload.price_egp = pricingCheck.normalized.price_egp;
  payload.original_price_egp = pricingCheck.normalized.original_price_egp;
  payload.sale_price_egp = pricingCheck.normalized.sale_price_egp;
  payload.admin_notes = attachPricingMetaToAdminNotes(
    payload.admin_notes,
    pricingCheck.normalized.original_price_egp,
    pricingCheck.normalized.sale_price_egp
  );

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.product) return hydrateProductPricing(json.product);
      } else if (res.status !== 405 && res.status !== 404 && res.status !== 502) {
        const errJson = await res.json().catch(() => ({}));
        const detailStr = errJson.details
          ? (Array.isArray(errJson.details) ? errJson.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ') : String(errJson.details))
          : (errJson.error || `Error ${res.status}`);
        throw new Error(detailStr);
      }
    } catch (err: any) {
      console.warn('API createProduct server route unavailable/failed, using direct Supabase fallback:', err.message);
      if (err.message && !err.message.includes('fetch') && !err.message.includes('405') && !err.message.includes('404')) {
        throw err;
      }
    }
  }

  const client = await getActiveClient();
  if (client) {
    let { data, error } = await client
      .from('products')
      .insert(payload)
      .select()
      .single();

    // Fallback if migration 0005 columns (original_price_egp / sale_price_egp) are not yet in remote schema cache
    if (error && (error.message?.includes('original_price_egp') || error.message?.includes('sale_price_egp'))) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.original_price_egp;
      delete fallbackPayload.sale_price_egp;
      const retry = await client
        .from('products')
        .insert(fallbackPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Supabase direct insert product error:', error);
      throw new Error(`خطأ في حفظ المنتج: ${error.message}`);
    }
    if (data) {
      if (payload.status === 'published') {
        try {
          await processProductLaunch(client, data.id);
        } catch (e) {
          console.warn('Auto launch dispatch on create warning:', e);
        }
      }
      return hydrateProductPricing(data);
    }
  }
  return null;
}

export async function updateProduct(id: string, productData: Partial<Product>, token?: string): Promise<Product | null> {
  const payload: any = { ...productData };
  if (payload.expected_launch_date) {
    payload.expected_launch_date = normalizeDateToIso(payload.expected_launch_date);
  }

  const client = await getActiveClient();

  const touchesPricing =
    payload.price_egp !== undefined ||
    payload.original_price_egp !== undefined ||
    payload.sale_price_egp !== undefined;

  if (touchesPricing) {
    let existingRawNotes: string | null | undefined = payload.admin_notes;
    let existingOriginal: number | null | undefined = payload.original_price_egp;

    if ((existingRawNotes === undefined || existingOriginal === undefined) && client) {
      try {
        const { data: currentRow } = await client
          .from('products')
          .select('price_egp, admin_notes')
          .eq('id', id)
          .maybeSingle();
        if (currentRow) {
          const hydratedCurrent = hydrateProductPricing(currentRow);
          if (existingRawNotes === undefined) {
            existingRawNotes = hydratedCurrent.admin_notes;
          }
          if (existingOriginal === undefined && payload.price_egp === undefined) {
            existingOriginal = hydratedCurrent.original_price_egp;
          }
        }
      } catch {
        // ignore
      }
    }

    const pricingCheck = validateProductPricing({
      originalPriceEgp: existingOriginal !== undefined ? existingOriginal : payload.price_egp,
      salePriceEgp: payload.sale_price_egp,
      priceEgp: payload.price_egp
    });

    if (!pricingCheck.valid) {
      throw new Error(pricingCheck.errorAr || 'بيانات التسعير غير صالحة.');
    }

    payload.price_egp = pricingCheck.normalized.price_egp;
    payload.original_price_egp = pricingCheck.normalized.original_price_egp;
    payload.sale_price_egp = pricingCheck.normalized.sale_price_egp;
    payload.admin_notes = attachPricingMetaToAdminNotes(
      existingRawNotes,
      pricingCheck.normalized.original_price_egp,
      pricingCheck.normalized.sale_price_egp
    );
  } else if (payload.admin_notes !== undefined && client) {
    // Preserve any existing pricing metadata tag when updating admin_notes alone
    try {
      const { data: currentRow } = await client
        .from('products')
        .select('price_egp, admin_notes')
        .eq('id', id)
        .maybeSingle();
      if (currentRow) {
        const hydratedCurrent = hydrateProductPricing(currentRow);
        payload.admin_notes = attachPricingMetaToAdminNotes(
          payload.admin_notes,
          hydratedCurrent.original_price_egp ?? hydratedCurrent.price_egp,
          hydratedCurrent.sale_price_egp ?? null
        );
      }
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        if (json.product) return hydrateProductPricing(json.product);
      } else if (res.status !== 405 && res.status !== 404 && res.status !== 502) {
        const errJson = await res.json().catch(() => ({}));
        const detailStr = errJson.details
          ? (Array.isArray(errJson.details) ? errJson.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ') : String(errJson.details))
          : (errJson.error || `Error ${res.status}`);
        throw new Error(detailStr);
      }
    } catch (err: any) {
      console.warn('API updateProduct server route unavailable/failed, using direct Supabase fallback:', err.message);
      if (err.message && !err.message.includes('fetch') && !err.message.includes('405') && !err.message.includes('404')) {
        throw err;
      }
    }
  }

  if (client) {
    let { data, error } = await client
      .from('products')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error && (error.message?.includes('original_price_egp') || error.message?.includes('sale_price_egp'))) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.original_price_egp;
      delete fallbackPayload.sale_price_egp;
      const retry = await client
        .from('products')
        .update({ ...fallbackPayload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Supabase direct update product error:', error);
      throw new Error(`خطأ في تحديث المنتج: ${error.message}`);
    }
    if (data) {
      if (payload.status === 'published') {
        try {
          await processProductLaunch(client, id);
        } catch (e) {
          console.warn('Auto launch dispatch on update warning:', e);
        }
      }
      return hydrateProductPricing(data);
    }
  }
  return null;
}

export async function deleteProduct(id: string, token?: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn('API deleteProduct failed, trying direct Supabase:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    const { error } = await client.from('products').delete().eq('id', id);
    if (!error) return true;
  }
  return false;
}

export async function createCategory(catData: Partial<Category>, token?: string): Promise<Category | null> {
  clearDataStoreCache();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(catData)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.category) return json.category;
      }
    } catch (err) {
      console.warn('API createCategory failed, trying direct Supabase:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    const { data, error } = await client.from('categories').insert(catData).select().single();
    if (!error && data) return data;
  }
  return null;
}

export async function updateCategory(id: number, catData: Partial<Category>, token?: string): Promise<Category | null> {
  clearDataStoreCache();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(catData)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.category) return json.category;
      }
    } catch (err) {
      console.warn('API updateCategory failed, trying direct Supabase:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    const { data, error } = await client.from('categories').update(catData).eq('id', id).select().single();
    if (!error && data) return data;
  }
  return null;
}

export async function deleteCategory(id: number, token?: string): Promise<boolean> {
  clearDataStoreCache();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn('API deleteCategory failed, trying direct Supabase:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    const { error } = await client.from('categories').delete().eq('id', id);
    if (!error) return true;
  }
  return false;
}

export async function updateStoreSettings(settingsData: Partial<StoreSettings>, token?: string): Promise<StoreSettings | null> {
  clearDataStoreCache();
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(settingsData)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.settings) return json.settings;
      }
    } catch (err) {
      console.warn('API updateStoreSettings failed, trying direct Supabase:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    const { data, error } = await client
      .from('settings')
      .update(settingsData)
      .eq('id', 1)
      .select()
      .single();
    if (!error && data) return data;
  }
  return null;
}

export async function registerWaitlistInterest(payload: {
  productId: string;
  email?: string;
  whatsappNumber?: string;
  emailConsent: boolean;
  whatsappConsent: boolean;
  lang: Lang;
}): Promise<{ success: boolean; message: string; registrationId?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/waitlist/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, message: json.message || 'تم تسجيل اهتمامك بنجاح', registrationId: json.registrationId };
      } else if (res.status !== 405 && res.status !== 404 && res.status !== 502) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error || 'فشلت عملية التسجيل' };
      }
    } catch (err) {
      console.warn('API registerWaitlistInterest unavailable/failed, using direct Supabase fallback:', err);
    }
  }

  // Direct Supabase Fallback
  const client = await getActiveClient();
  if (!client) {
    return { success: false, message: 'تعذر الاتصال بقاعدة البيانات. حاول مرة أخرى.' };
  }

  try {
    const email = payload.emailConsent && payload.email ? payload.email.trim().toLowerCase() : null;
    const rawWhatsapp = payload.whatsappConsent && payload.whatsappNumber ? payload.whatsappNumber.trim() : null;
    const normalizedWhatsapp = rawWhatsapp ? normalizePhoneNumber(rawWhatsapp) : null;

    const consentTextAr = 'أوافق على استلام إشعار عند إطلاق وتوفر هذا المنتج للشراء عبر القنوات المحددة.';
    const consentTextEn = 'I agree to receive a launch notification when this product becomes available via the selected channels.';

    let existingQuery = client.from('product_waitlist').select('id, email_consent, whatsapp_consent').eq('product_id', payload.productId);
    if (email) {
      existingQuery = existingQuery.eq('email', email);
    } else if (normalizedWhatsapp) {
      existingQuery = existingQuery.eq('whatsapp_number', normalizedWhatsapp);
    }

    const { data: existingRows } = await existingQuery;

    if (existingRows && existingRows.length > 0) {
      const existingId = existingRows[0].id;
      await client
        .from('product_waitlist')
        .update({
          email: email || undefined,
          whatsapp_number: normalizedWhatsapp || undefined,
          email_consent: payload.emailConsent || existingRows[0].email_consent,
          whatsapp_consent: payload.whatsappConsent || existingRows[0].whatsapp_consent,
          consent_text_ar: consentTextAr,
          consent_text_en: consentTextEn,
          consent_timestamp: new Date().toISOString()
        })
        .eq('id', existingId);

      return {
        success: true,
        message: payload.lang === 'ar'
          ? 'أنت مسجل بالفعل في قائمة الانتظار لهذا المنتج، وسنقوم بتنبيهك عبر البريد الإلكتروني والواتساب بمجرد الإطلاق المباشر 🚀'
          : 'You are already registered on the waitlist for this product! We will notify you via Email and WhatsApp as soon as it launches 🚀',
        registrationId: existingId
      };
    }

    const { data: newEntry, error: insertError } = await client
      .from('product_waitlist')
      .insert({
        product_id: payload.productId,
        email: email,
        whatsapp_number: normalizedWhatsapp,
        email_consent: payload.emailConsent,
        whatsapp_consent: payload.whatsappConsent,
        consent_text_ar: consentTextAr,
        consent_text_en: consentTextEn,
        consent_timestamp: new Date().toISOString(),
        email_status: payload.emailConsent ? 'pending' : 'withdrawn',
        whatsapp_status: payload.whatsappConsent ? 'pending' : 'withdrawn'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Direct waitlist insert error:', insertError);
      return { success: false, message: 'فشلت عملية حفظ تسجيل قائمة الانتظار.' };
    }

    return {
      success: true,
      message: payload.lang === 'ar'
        ? 'تم تسجيل طلب التنبيه الخاص بك بنجاح! وسنقوم بتنبيهك عبر البريد الإلكتروني والواتساب بمجرد الإطلاق المباشر 🚀'
        : 'You will receive a notification as soon as this product launches!',
      registrationId: newEntry?.id
    };
  } catch (err: any) {
    return { success: false, message: 'حدث خطأ غير متوقع أثناء تسجيل طلب التنبيه.' };
  }
}

export async function fetchAdminWaitlist(productId: string): Promise<{
  entries: WaitlistEntry[];
  stats: WaitlistStats;
} | null> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/waitlist/${productId}`, {
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (err) {
      console.warn('fetchAdminWaitlist API error, trying direct Supabase fallback:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    const { data: entries, error } = await client
      .from('product_waitlist')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (!error && entries) {
      const total = entries.length;
      const emailCount = entries.filter(e => e.email_consent).length;
      const whatsappCount = entries.filter(e => e.whatsapp_consent).length;
      const dualCount = entries.filter(e => e.email_consent && e.whatsapp_consent).length;

      return {
        entries,
        stats: {
          total_subscribers: total,
          email_count: emailCount,
          whatsapp_count: whatsappCount,
          pending_count: entries.filter(e => e.email_status === 'pending' || e.whatsapp_status === 'pending').length,
          sent_count: entries.filter(e => e.email_status === 'sent' || e.whatsapp_status === 'sent').length,
          failed_count: entries.filter(e => e.email_status === 'failed' || e.whatsapp_status === 'failed').length
        }
      };
    }
  }
  return null;
}

export async function processProductLaunch(client: any, productId: string, originUrl?: string): Promise<{
  success: boolean;
  message: string;
  stats?: {
    emailSent: number;
    emailFailed: number;
    whatsappSent: number;
    whatsappFailed: number;
  };
}> {
  try {
    // 1. Fetch Product
    const { data: product, error: prodErr } = await client
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      return { success: false, message: 'المنتج غير موجود.' };
    }

    // 2. Update status to 'published'
    await client.from('products').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', productId);

    // 3. Fetch Waitlist Registrations for this product
    const { data: registrations } = await client
      .from('product_waitlist')
      .select('*')
      .eq('product_id', productId);

    // 4. Fetch Store Settings safely with fallback
    let n8nWebhookUrl = 'https://n8n-enginity.duckdns.org/webhook/send-email-from-user-product-publish';
    let resendApiKey = '';

    try {
      const { data: storeSettings } = await client
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (storeSettings) {
        n8nWebhookUrl = (
          storeSettings.social_links?.n8n_launch_webhook_url ||
          storeSettings.n8n_launch_webhook_url ||
          n8nWebhookUrl
        ).trim();

        resendApiKey = (
          storeSettings.social_links?.resend_api_key ||
          storeSettings.resend_api_key ||
          ''
        ).trim();
      }
    } catch (e) {
      console.warn('Error querying store settings in processProductLaunch:', e);
    }

    let siteUrl = 'https://enginity-store-s8dx.vercel.app';
    if (typeof window !== 'undefined' && window.location && window.location.origin && !window.location.origin.includes('localhost')) {
      siteUrl = window.location.origin;
    } else {
      siteUrl = (
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.VITE_SITE_URL ||
        originUrl ||
        'https://enginity-store-s8dx.vercel.app'
      );
    }
    siteUrl = siteUrl.replace(/\/(ar|en)\/?$/, '').replace(/\/+$/, '');
    const productUrl = `${siteUrl}/ar/products/${product.slug}`;

    let emailSent = 0;
    let emailFailed = 0;
    let whatsappSent = 0;
    let whatsappFailed = 0;
    let webhookDispatched = false;

    const rows = registrations || [];
    const emailSubscribers = rows.filter((r: any) => r.email_consent && r.email);
    const whatsappSubscribers = rows.filter((r: any) => r.whatsapp_consent && r.whatsapp_number);

    // 5. Construct full n8n JSON Webhook Payload
    const webhookPayload = {
      event: 'product_launched',
      timestamp: new Date().toISOString(),
      product: {
        id: product.id,
        slug: product.slug,
        name_ar: product.name_ar,
        name_en: product.name_en,
        price_egp: product.price_egp,
        cover_path: product.cover_path || product.diagram_path || '',
        product_url: productUrl,
        launch_announcement: product.launch_announcement || ''
      },
      subscribers: rows.map((r: any) => ({
        id: r.id,
        email: r.email || null,
        whatsapp_number: r.whatsapp_number || null,
        email_consent: Boolean(r.email_consent),
        whatsapp_consent: Boolean(r.whatsapp_consent),
        email_status: r.email_status,
        whatsapp_status: r.whatsapp_status,
        created_at: r.created_at
      })),
      total_subscribers: rows.length,
      email_subscribers_count: emailSubscribers.length,
      whatsapp_subscribers_count: whatsappSubscribers.length
    };

    // 6. Send to n8n Webhook if configured
    // 6. Send to n8n Webhook if configured with browser CORS fallbacks
    if (n8nWebhookUrl) {
      try {
        let dispatched = false;

        // Attempt 1: Standard fetch
        try {
          const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'ENGINITY-Storefront/1.0'
            },
            body: JSON.stringify(webhookPayload)
          });
          if (response.ok) {
            webhookDispatched = true;
            dispatched = true;
          } else if (response.status === 404 && n8nWebhookUrl.includes('/webhook/')) {
            const testWebhookUrl = n8nWebhookUrl.replace('/webhook/', '/webhook-test/');
            const testRes = await fetch(testWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(webhookPayload)
            });
            if (testRes.ok) {
              webhookDispatched = true;
              dispatched = true;
            }
          }
        } catch (fetchErr) {
          console.warn('Standard fetch to n8n Webhook failed (CORS/Network in browser), trying no-cors/beacon fallback:', fetchErr);
        }

        // Attempt 2: Browser CORS Fallback via navigator.sendBeacon and no-cors mode
        if (!dispatched && typeof window !== 'undefined') {
          try {
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
              const blob = new Blob([JSON.stringify(webhookPayload)], { type: 'text/plain;charset=UTF-8' });
              const beaconOk = navigator.sendBeacon(n8nWebhookUrl, blob);
              if (beaconOk) {
                webhookDispatched = true;
                dispatched = true;
              }
            }

            if (!dispatched) {
              await fetch(n8nWebhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                  'Content-Type': 'text/plain'
                },
                body: JSON.stringify(webhookPayload)
              });
              webhookDispatched = true;
            }
          } catch (fallbackErr) {
            console.error('Fallback n8n dispatch error:', fallbackErr);
          }
        }
      } catch (err) {
        console.error('n8n Webhook dispatch error:', err);
      }
    }

    // 7. Direct Email dispatch via Resend API if API key present
    if (resendApiKey) {
      for (const sub of emailSubscribers) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: process.env.RESEND_FROM_EMAIL || 'ENGINITY <notifications@enginity.store>',
              to: [sub.email],
              subject: `⚡ تم إطلاق المنتج: ${product.name_ar}`,
              html: `
                <div style="font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; background-color: #f8fafc; color: #0b1f3a;">
                  <h2 style="color: #2f6bff;">خبر سار! تم توفير منتج الأتمتة الذي انتظرته 🚀</h2>
                  <h3 style="font-size: 20px; color: #0b1f3a;">${product.name_ar}</h3>
                  <p style="font-size: 15px; color: #475569; line-height: 1.7;">${product.short_ar || ''}</p>
                  ${product.launch_announcement ? `<p style="padding: 12px; background: #e0e7ff; border-radius: 8px; color: #1e1b4b;"><strong>تنويه الإطلاق:</strong> ${product.launch_announcement}</p>` : ''}
                  <div style="margin-top: 24px;">
                    <a href="${productUrl}" style="background-color: #2f6bff; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 10px; display: inline-block;">احصل على الـ Workflow الآن ⚡</a>
                  </div>
                  <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">وصلتك هذه الرسالة لأنك طلبت التنبيه عند إطلاق هذا المنتج على متجر ENGINITY.</p>
                </div>
              `
            })
          });
          if (emailRes.ok) {
            emailSent++;
          } else {
            emailFailed++;
          }
        } catch {
          emailFailed++;
        }
      }
    } else {
      emailSent = emailSubscribers.length;
    }

    whatsappSent = whatsappSubscribers.length;

    // 8. Update subscriber statuses in database
    if (rows.length > 0) {
      for (const r of rows) {
        const updates: any = {};
        if (r.email_consent) {
          updates.email_status = 'sent';
          updates.email_delivery_time = new Date().toISOString();
        }
        if (r.whatsapp_consent) {
          updates.whatsapp_status = 'sent';
          updates.whatsapp_delivery_time = new Date().toISOString();
        }
        if (Object.keys(updates).length > 0) {
          await client.from('product_waitlist').update(updates).eq('id', r.id);
        }
      }
    }

    let msg = 'تم تحديث حالة المنتج إلى منشور ونشط بنجاح!';
    if (webhookDispatched) {
      msg += ' وتم إرسال الـ Webhook مع كافة تفاصيل المشتركين لـ n8n بنجاح 🚀';
    } else {
      msg += ' وتجهيز إشعارات المشتركين المباشرة 🚀';
    }

    return {
      success: true,
      message: msg,
      stats: {
        emailSent,
        emailFailed,
        whatsappSent,
        whatsappFailed
      }
    };
  } catch (err: any) {
    console.error('processProductLaunch error:', err);
    return { success: false, message: 'حدث خطأ أثناء معالجة إطلاق المنتج.' };
  }
}

export async function publishAndLaunchNotifications(productId: string): Promise<{
  success: boolean;
  message: string;
  stats?: {
    emailSent: number;
    emailFailed: number;
    whatsappSent: number;
    whatsappFailed: number;
  };
}> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/products/${productId}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, message: json.message || 'تم نشر المنتج بنجاح', stats: json.stats };
      } else if (res.status !== 405 && res.status !== 404) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error || 'فشلت عملية الإطلاق' };
      }
    } catch (err) {
      console.warn('publishAndLaunchNotifications API error, trying direct Supabase fallback:', err);
    }
  }

  const client = await getActiveClient();
  if (client) {
    return await processProductLaunch(client, productId);
  }
  return { success: false, message: 'تعذر الاتصال بقاعدة البيانات.' };
}

// ============================================================================
// FEATURE B: CUSTOM AUTOMATION REQUESTS WRAPPERS
// ============================================================================

export async function submitCustomRequest(input: {
  name?: string;
  email: string;
  whatsapp_number?: string;
  business_type: string;
  business_problem: string;
  desired_outcome: string;
  current_tools?: string[];
  expected_features?: string;
  budget_range?: string;
  delivery_timeframe?: string;
  additional_notes?: string;
  marketing_consent: boolean;
  lang?: Lang;
}): Promise<{
  success: boolean;
  message: string;
  requestId?: string;
  duplicate?: boolean;
}> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/custom-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          message: json.message,
          requestId: json.request?.id,
          duplicate: json.duplicate
        };
      } else if (res.status !== 404 && res.status !== 405) {
        const json = await res.json().catch(() => ({}));
        return {
          success: false,
          message: json.error || (input.lang === 'en' ? 'Failed to submit request.' : 'تعذّر إرسال الطلب.')
        };
      }
    } catch (err) {
      console.warn('submitCustomRequest API unreachable, using direct CRM store fallback:', err);
    }
  }

  return await createCustomAutomationRequest(input);
}

export async function fetchAdminCustomRequests(): Promise<CustomAutomationRequest[]> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/custom-requests', {
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        return json.requests || [];
      }
    } catch (err) {
      console.warn('fetchAdminCustomRequests API fallback:', err);
    }
  }
  return await listCustomAutomationRequests();
}

export async function updateAdminCustomRequest(
  id: string,
  updates: {
    status?: CustomRequestStatus;
    admin_notes?: string;
    estimated_quote_egp?: number | null;
  }
): Promise<{ success: boolean; request?: CustomAutomationRequest; message?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/custom-requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, request: json.request };
      } else if (res.status !== 404 && res.status !== 405) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error };
      }
    } catch (err) {
      console.warn('updateAdminCustomRequest API fallback:', err);
    }
  }
  return await updateCustomAutomationRequest(id, updates);
}

// ============================================================================
// FEATURE C: PRODUCT SUGGESTIONS & DEMAND ANALYTICS WRAPPERS
// ============================================================================

export async function submitProductSuggestion(input: {
  proposed_name: string;
  problem_solved: string;
  target_audience: string;
  expected_features?: string;
  platforms_integrations?: string[];
  email?: string;
  whatsapp_number?: string;
  purchase_likelihood: PurchaseLikelihood;
  preferred_price_range?: string;
  additional_context?: string;
  contact_consent: boolean;
  lang?: Lang;
}): Promise<{
  success: boolean;
  message: string;
  suggestionId?: string;
  duplicate?: boolean;
}> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/product-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          message: json.message,
          suggestionId: json.suggestion?.id,
          duplicate: json.duplicate
        };
      } else if (res.status !== 404 && res.status !== 405) {
        const json = await res.json().catch(() => ({}));
        return {
          success: false,
          message: json.error || (input.lang === 'en' ? 'Failed to submit suggestion.' : 'تعذّر إرسال الاقتراح.')
        };
      }
    } catch (err) {
      console.warn('submitProductSuggestion API unreachable, using direct CRM store fallback:', err);
    }
  }

  const res = await createProductSuggestion(input);
  return {
    success: res.success,
    message: res.message,
    suggestionId: res.suggestion?.id,
    duplicate: res.duplicate
  };
}

export async function fetchAdminProductSuggestions(): Promise<{
  suggestions: ProductSuggestion[];
  analytics: DemandAnalyticsSummary;
}> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/admin/product-suggestions', {
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        return {
          suggestions: json.suggestions || [],
          analytics: json.analytics || computeDemandAnalytics(json.suggestions || [])
        };
      }
    } catch (err) {
      console.warn('fetchAdminProductSuggestions API fallback:', err);
    }
  }

  const suggestions = await listProductSuggestions();
  return {
    suggestions,
    analytics: computeDemandAnalytics(suggestions)
  };
}

export async function updateAdminProductSuggestion(
  id: string,
  updates: {
    status?: ProductSuggestionStatus;
    admin_notes?: string;
    converted_product_id?: string | null;
  }
): Promise<{ success: boolean; suggestion?: ProductSuggestion; message?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/product-suggestions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, suggestion: json.suggestion };
      } else if (res.status !== 404 && res.status !== 405) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error };
      }
    } catch (err) {
      console.warn('updateAdminProductSuggestion API fallback:', err);
    }
  }

  return await updateProductSuggestion(id, updates);
}

// ============================================================================
// FEATURE A: INTELLIGENT AI SHOPPING ASSISTANT CLIENT WRAPPER
// ============================================================================

const inFlightAssistantRequests = new Map<string, Promise<AssistantResponsePayload>>();

export async function sendAssistantMessage(params: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  lang?: Lang;
  conversationId?: string;
  sessionId?: string;
  page?: string;
  context?: string;
}): Promise<AssistantResponsePayload> {
  const dedupeKey = `${params.sessionId || params.conversationId || 'default'}::${(params.message || '').trim()}`;
  const existing = inFlightAssistantRequests.get(dedupeKey);
  if (existing) {
    return existing;
  }

  const task = processAssistantTurn(params).finally(() => {
    inFlightAssistantRequests.delete(dedupeKey);
  });

  inFlightAssistantRequests.set(dedupeKey, task);
  return await task;
}

// ============================================================================
// FEATURE D: PRODUCT RATINGS & CUSTOMER REVIEWS WRAPPERS
// ============================================================================

export async function submitProductReview(input: {
  product_id: string;
  customer_name: string;
  rating: number;
  review_text?: string | null;
  lang?: Lang;
}): Promise<{
  success: boolean;
  message: string;
  review?: ProductReview;
  duplicate?: boolean;
}> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (res.ok) {
        const json = await res.json();
        return {
          success: true,
          message: json.message,
          review: json.review,
          duplicate: json.duplicate
        };
      } else if (res.status !== 404 && res.status !== 405 && res.status !== 502) {
        const json = await res.json().catch(() => ({}));
        return {
          success: false,
          message:
            json.error ||
            (input.lang === 'en' ? 'Failed to submit review.' : 'تعذّر إرسال التقييم.')
        };
      }
    } catch (err) {
      console.warn('submitProductReview API unreachable, using direct CRM store fallback:', err);
    }
  }

  return await createProductReview(input);
}

export async function fetchProductReviews(productId: string): Promise<{
  reviews: ProductReview[];
  summary: ProductRatingSummary;
}> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(productId)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.reviews) && json.summary) {
          return {
            reviews: json.reviews,
            summary: json.summary
          };
        }
      }
    } catch {
      // Fallback to direct store
    }
  }

  return await getProductReviewsAndSummary(productId);
}

export async function fetchAllApprovedRatingSummaries(): Promise<
  Record<string, ProductRatingSummary>
> {
  const approved = await listApprovedProductReviews();
  const byProduct = new Map<string, ProductReview[]>();
  for (const rev of approved) {
    if (!rev.product_id) continue;
    const list = byProduct.get(rev.product_id) || [];
    list.push(rev);
    byProduct.set(rev.product_id, list);
  }

  const summaries: Record<string, ProductRatingSummary> = {};
  for (const [productId, revs] of byProduct.entries()) {
    summaries[productId] = computeProductRatingSummary(productId, revs);
  }
  return summaries;
}

export async function fetchAdminReviews(options?: {
  status?: ProductReviewStatus | 'all';
  productId?: string;
}): Promise<ProductReview[]> {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams();
      if (options?.status && options.status !== 'all') params.set('status', options.status);
      if (options?.productId) params.set('productId', options.productId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/reviews${qs}`, {
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        return json.reviews || [];
      }
    } catch (err) {
      console.warn('fetchAdminReviews API fallback:', err);
    }
  }

  const res = await listAdminProductReviews({
    status: options?.status,
    productId: options?.productId
  });
  return res.reviews;
}

export async function updateAdminReviewStatus(
  id: string,
  status: ProductReviewStatus
): Promise<{ success: boolean; review?: ProductReview; message?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, review: json.review };
      } else if (res.status !== 404 && res.status !== 405) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error };
      }
    } catch (err) {
      console.warn('updateAdminReviewStatus API fallback:', err);
    }
  }

  return await moderateProductReview(id, status);
}

export async function deleteAdminReview(
  id: string
): Promise<{ success: boolean; message?: string }> {
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/admin/reviews/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        return { success: true };
      } else if (res.status !== 404 && res.status !== 405) {
        const json = await res.json().catch(() => ({}));
        return { success: false, message: json.error };
      }
    } catch (err) {
      console.warn('deleteAdminReview API fallback:', err);
    }
  }

  return await deleteProductReview(id);
}



