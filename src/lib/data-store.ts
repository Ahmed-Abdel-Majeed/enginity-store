import {
  AdminProduct,
  AssistantResponsePayload,
  Category,
  Lang,
  Product,
  StoreSettings,
} from '../types';
import {
  supabase,
  isSupabaseConfigured,
  createAuthenticatedClient,
  verifyAdminSession,
  getSystemAdminToken,
} from './supabase';
import { getEffectiveProductPricing } from './utils';
import { processAssistantTurn } from './assistant-engine';
import {
  registerWaitlistInterest,
  submitWaitlistEntry,
  fetchWaitlistEntries,
  fetchAdminWaitlist,
  publishAndLaunchNotifications,
  submitCustomRequest,
  createCustomAutomationRequest,
  fetchAdminCustomRequests,
  updateAdminCustomRequest,
  submitProductSuggestion,
  createProductSuggestion,
  fetchAdminProductSuggestions,
  updateAdminProductSuggestion,
  fetchProductReviews,
  fetchAllApprovedRatingSummaries,
  submitProductReview,
  fetchAdminReviews,
  updateAdminReviewStatus,
  deleteAdminReview,
} from './crm-store';

export {
  registerWaitlistInterest,
  submitWaitlistEntry,
  fetchWaitlistEntries,
  fetchAdminWaitlist,
  publishAndLaunchNotifications,
  submitCustomRequest,
  createCustomAutomationRequest,
  fetchAdminCustomRequests,
  updateAdminCustomRequest,
  submitProductSuggestion,
  createProductSuggestion,
  fetchAdminProductSuggestions,
  updateAdminProductSuggestionsCompat as updateProductSuggestion,
  updateAdminProductSuggestion,
  fetchProductReviews,
  fetchAllApprovedRatingSummaries,
  submitProductReview,
  fetchAdminReviews,
  updateAdminReviewStatus,
  deleteAdminReview,
};

const updateAdminProductSuggestionsCompat = updateAdminProductSuggestion;

export const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'slug',
  'status',
  'category_id',
  'name_ar',
  'name_en',
  'short_ar',
  'short_en',
  'description_ar',
  'description_en',
  'price_egp',
  'original_price_egp',
  'sale_price_egp',
  'xpay_url',
  'cover_path',
  'diagram_path',
  'video_url',
  'tools',
  'level',
  'includes_ar',
  'includes_en',
  'requirements_ar',
  'requirements_en',
  'steps_ar',
  'steps_en',
  'faq',
  'sort_order',
  'expected_launch_date',
  'launch_announcement',
  'waitlist_enabled',
  'created_at',
  'updated_at',
  'category:categories(*)',
].join(', ');

export const ADMIN_PRODUCT_COLUMNS = '*, category:categories(*)';

export const DEFAULT_SETTINGS: StoreSettings = {
  id: 1,
  usd_rate: 50,
  whatsapp_number: '201000000000',
  whatsapp_default_message: 'مرحباً فريق ENGINITY، لدي استفسار بخصوص منتجات الأتمتة.',
  author_name: 'ENGINITY',
  author_bio_ar: 'منصة متخصصة في حلول الأتمتة والذكاء الاصطناعي الجاهزة للتشغيل الفوري.',
  author_bio_en: 'Specialized marketplace for production-ready AI and workflow automation systems.',
  author_photo: '',
  author_followers_text_ar: '+10,000 متابع ومهتم بالأتمتة',
  author_followers_text_en: '10,000+ Automation Enthusiasts',
  contact_email: 'contact@enginity.store',
  social_links: {},
  general_faq: [],
  buy_notice_enabled: true,
  buy_notice_ar: 'سيتم إرسال ملفات النظام وشرح الإعداد فوراً إلى بريدك الإلكتروني بعد إتمام الدفع.',
  buy_notice_en:
    'Workflow files and setup guide will be delivered immediately to your email after payment.',
};

function normalizeLevel(rawLevel: any): 'beginner' | 'intermediate' | 'advanced' {
  const lower = String(rawLevel || 'intermediate').toLowerCase();
  if (lower === 'beginner') return 'beginner';
  if (lower === 'advanced') return 'advanced';
  return 'intermediate';
}

function sanitizePublicProduct(raw: any): Product {
  const pricing = getEffectiveProductPricing({
    price_egp: Number(raw?.price_egp ?? 0),
    original_price_egp: raw?.original_price_egp,
    sale_price_egp: raw?.sale_price_egp,
  });

  const cleaned: Product = {
    id: String(raw.id),
    slug: String(raw.slug || ''),
    status: raw.status || 'published',
    category_id: raw.category_id ?? null,
    name_ar: raw.name_ar || '',
    name_en: raw.name_en || '',
    short_ar: raw.short_ar || '',
    short_en: raw.short_en || '',
    description_ar: raw.description_ar || '',
    description_en: raw.description_en || '',
    price_egp: pricing.effectivePriceEgp,
    original_price_egp: pricing.originalPriceEgp,
    sale_price_egp: pricing.salePriceEgp,
    discount_percentage: pricing.discountPercentage,
    xpay_url: raw.xpay_url || '',
    cover_path: raw.cover_path || '',
    diagram_path: raw.diagram_path || '',
    video_url: raw.video_url || '',
    tools: Array.isArray(raw.tools) ? raw.tools : [],
    level: normalizeLevel(raw.level),
    includes_ar: Array.isArray(raw.includes_ar) ? raw.includes_ar : [],
    includes_en: Array.isArray(raw.includes_en) ? raw.includes_en : [],
    requirements_ar: Array.isArray(raw.requirements_ar) ? raw.requirements_ar : [],
    requirements_en: Array.isArray(raw.requirements_en) ? raw.requirements_en : [],
    steps_ar: Array.isArray(raw.steps_ar) ? raw.steps_ar : [],
    steps_en: Array.isArray(raw.steps_en) ? raw.steps_en : [],
    faq: Array.isArray(raw.faq) ? raw.faq : [],
    sort_order: Number(raw.sort_order ?? 0),
    expected_launch_date: raw.expected_launch_date || null,
    launch_announcement: raw.launch_announcement || '',
    waitlist_enabled: raw.waitlist_enabled !== false,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    category: raw.category || undefined,
  };

  // Strictly strip sensitive deliverable & internal fields from public objects (TASK-001)
  delete (cleaned as any).file_url;
  delete (cleaned as any).admin_notes;

  return cleaned;
}

function normalizeAdminProduct(raw: any, deliverableFileUrl?: string): AdminProduct {
  const base = sanitizePublicProduct(raw);
  return {
    ...base,
    file_url: deliverableFileUrl ?? raw.file_url ?? '',
    admin_notes: raw.admin_notes || '',
  };
}

async function requireVerifiedAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  if (typeof window !== 'undefined') {
    const verification = await verifyAdminSession();
    if (!verification.isAuthenticated || !verification.isAdmin || !verification.accessToken) {
      throw new Error(
        verification.error ||
          'Unauthorized: Active administrator session required for this operation.'
      );
    }
    return {
      client: createAuthenticatedClient(verification.accessToken),
      token: verification.accessToken,
    };
  }

  const sysToken = await getSystemAdminToken();
  if (!sysToken) {
    throw new Error('Unauthorized: Missing system administrator token.');
  }
  const authed = createAuthenticatedClient(sysToken);
  const { data: isAdmin, error } = await authed.rpc('is_admin');
  if (error || !isAdmin) {
    throw new Error('Forbidden: System user is not an authorized administrator.');
  }
  return { client: authed, token: sysToken };
}

// ==========================================
// Products Read Operations (TASK-001, TASK-004)
// ==========================================
export interface FetchProductsOptions {
  publishedOnly?: boolean;
  includeAllStatuses?: boolean;
  throwOnError?: boolean;
}

export async function fetchProducts(
  optionsOrIncludeAll?: boolean | FetchProductsOptions
): Promise<Product[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const isBoolean = typeof optionsOrIncludeAll === 'boolean';
  const includeAllStatuses = isBoolean
    ? optionsOrIncludeAll
    : Boolean(optionsOrIncludeAll?.includeAllStatuses || optionsOrIncludeAll?.publishedOnly === false);
  const throwOnError = !isBoolean && Boolean(optionsOrIncludeAll?.throwOnError);

  if (includeAllStatuses) {
    const { client } = await requireVerifiedAdminClient();
    const { data, error } = await client
      .from('products')
      .select(ADMIN_PRODUCT_COLUMNS)
      .order('sort_order', { ascending: true });

    if (error) {
      if (throwOnError) throw new Error(error.message);
      return [];
    }

    const delivMap = new Map<string, string>();
    try {
      const { data: deliverables } = await client
        .from('product_deliverables')
        .select('product_id, file_url');
      for (const d of deliverables || []) {
        if (d?.product_id) {
          delivMap.set(d.product_id, d.file_url || '');
        }
      }
    } catch {
      // Ignore if table not yet migrated
    }

    return (data || []).map((row: any) =>
      normalizeAdminProduct(row, delivMap.get(row.id))
    );
  }

  // Public storefront query: explicitly select only public columns (no file_url, no admin_notes)
  const { data, error } = await supabase
    .from('products')
    .select(PUBLIC_PRODUCT_COLUMNS)
    .in('status', ['published', 'coming_soon'])
    .order('sort_order', { ascending: true });

  if (error) {
    if (throwOnError) throw new Error(error.message);
    return [];
  }

  return (data || []).map((row: any) => sanitizePublicProduct(row));
}

export async function fetchProductBySlug(
  slug: string,
  includeAllStatuses = false
): Promise<Product | null> {
  if (!isSupabaseConfigured() || !slug) {
    return null;
  }

  if (includeAllStatuses) {
    const { client } = await requireVerifiedAdminClient();
    const { data, error } = await client
      .from('products')
      .select(ADMIN_PRODUCT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) return null;

    let fileUrl = (data as any).file_url || '';
    try {
      const { data: deliv } = await client
        .from('product_deliverables')
        .select('file_url')
        .eq('product_id', (data as any).id)
        .maybeSingle();
      if (deliv?.file_url) {
        fileUrl = deliv.file_url;
      }
    } catch {
      // Ignore
    }

    return normalizeAdminProduct(data, fileUrl);
  }

  const { data, error } = await supabase
    .from('products')
    .select(PUBLIC_PRODUCT_COLUMNS)
    .eq('slug', slug)
    .in('status', ['published', 'coming_soon'])
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return sanitizePublicProduct(data);
}

// ==========================================
// Admin Product Mutations (TASK-001, TASK-004, TASK-005)
// ==========================================
function buildDatabaseProductPayload(productData: Partial<AdminProduct>) {
  const payload: Record<string, any> = { ...productData };
  delete payload.id;
  delete payload.created_at;
  delete payload.category;
  delete payload.file_url;
  delete payload.discount_percentage;

  if (payload.original_price_egp !== undefined || payload.sale_price_egp !== undefined || payload.price_egp !== undefined) {
    const rawOriginal =
      payload.original_price_egp !== undefined && payload.original_price_egp !== null
        ? Number(payload.original_price_egp)
        : Number(payload.price_egp ?? 0);
    const originalPriceEgp = Number.isFinite(rawOriginal) && rawOriginal >= 0 ? rawOriginal : 0;

    const rawSale =
      payload.sale_price_egp !== undefined &&
      payload.sale_price_egp !== null &&
      String(payload.sale_price_egp).trim() !== ''
        ? Number(payload.sale_price_egp)
        : null;

    if (rawSale !== null && Number.isFinite(rawSale) && rawSale > 0) {
      if (rawSale >= originalPriceEgp) {
        throw new Error('Discounted price must be strictly less than original price');
      }
      payload.original_price_egp = originalPriceEgp;
      payload.sale_price_egp = rawSale;
      payload.price_egp = rawSale;
    } else {
      payload.original_price_egp = originalPriceEgp;
      payload.sale_price_egp = null;
      payload.price_egp = originalPriceEgp;
    }
  }

  payload.updated_at = new Date().toISOString();
  return payload;
}

async function upsertProductDeliverable(
  client: any,
  productId: string,
  fileUrl?: string
): Promise<void> {
  if (fileUrl === undefined) return;
  try {
    await client.from('product_deliverables').upsert(
      {
        product_id: productId,
        file_url: String(fileUrl || '').trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id' }
    );
  } catch {
    // Ignore if product_deliverables table is not yet migrated in remote DB
  }
}

export async function createProduct(
  productData: Partial<AdminProduct>
): Promise<AdminProduct> {
  const { client } = await requireVerifiedAdminClient();
  const deliverableUrl =
    typeof productData.file_url === 'string' ? productData.file_url.trim() : '';
  const dbPayload = buildDatabaseProductPayload(productData);

  const { data, error } = await client
    .from('products')
    .insert(dbPayload)
    .select(ADMIN_PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create product in database');
  }

  await upsertProductDeliverable(client, (data as any).id, deliverableUrl);
  return normalizeAdminProduct(data, deliverableUrl);
}

export async function updateProduct(
  id: string,
  productData: Partial<AdminProduct>
): Promise<AdminProduct> {
  const { client } = await requireVerifiedAdminClient();
  const deliverableUrl =
    typeof productData.file_url === 'string' ? productData.file_url.trim() : undefined;

  // Fetch existing row if pricing fields are partially updated
  let mergedPricingData = { ...productData };
  if (
    (productData.original_price_egp !== undefined || productData.sale_price_egp !== undefined) &&
    productData.price_egp === undefined
  ) {
    const { data: current } = await client
      .from('products')
      .select('price_egp, original_price_egp, sale_price_egp')
      .eq('id', id)
      .maybeSingle();
    if (current) {
      mergedPricingData = {
        price_egp: current.price_egp,
        original_price_egp: current.original_price_egp,
        sale_price_egp: current.sale_price_egp,
        ...productData,
      };
    }
  }

  const dbPayload = buildDatabaseProductPayload(mergedPricingData);

  const { data, error } = await client
    .from('products')
    .update(dbPayload)
    .eq('id', id)
    .select(ADMIN_PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update product in database');
  }

  await upsertProductDeliverable(client, id, deliverableUrl);
  return normalizeAdminProduct(data, deliverableUrl);
}

export async function deleteProduct(id: string): Promise<boolean> {
  const { client } = await requireVerifiedAdminClient();
  const { error } = await client.from('products').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Failed to delete product from database');
  }
  return true;
}

// ==========================================
// Categories Read & Admin Write Operations (TASK-005)
// ==========================================
export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as Category[];
}

export async function createCategory(categoryData: Partial<Category>): Promise<Category> {
  const { client } = await requireVerifiedAdminClient();
  const payload = { ...categoryData };
  delete payload.id;
  delete payload.created_at;

  const { data, error } = await client
    .from('categories')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create category');
  }

  return data as Category;
}

export async function updateCategory(
  id: number | string,
  categoryData: Partial<Category>
): Promise<Category> {
  const { client } = await requireVerifiedAdminClient();
  const payload = { ...categoryData };
  delete payload.id;
  delete payload.created_at;

  const { data, error } = await client
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update category');
  }

  return data as Category;
}

export async function deleteCategory(id: number | string): Promise<boolean> {
  const { client } = await requireVerifiedAdminClient();
  const { error } = await client.from('categories').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Failed to delete category');
  }
  return true;
}

// ==========================================
// Settings Read & Admin Write Operations (TASK-005)
// ==========================================
function extractBuyNoticeConfig(settingsRow: any): Partial<StoreSettings> {
  const socialLinks = { ...(settingsRow?.social_links || {}) };
  let buy_notice_enabled =
    typeof settingsRow?.buy_notice_enabled === 'boolean'
      ? settingsRow.buy_notice_enabled
      : true;
  let buy_notice_ar =
    settingsRow?.buy_notice_ar || DEFAULT_SETTINGS.buy_notice_ar || '';
  let buy_notice_en =
    settingsRow?.buy_notice_en || DEFAULT_SETTINGS.buy_notice_en || '';

  if (typeof socialLinks.__buy_notice_meta === 'string') {
    try {
      const parsed = JSON.parse(socialLinks.__buy_notice_meta);
      if (typeof parsed.buy_notice_enabled === 'boolean') {
        buy_notice_enabled = parsed.buy_notice_enabled;
      }
      if (typeof parsed.buy_notice_ar === 'string') {
        buy_notice_ar = parsed.buy_notice_ar;
      }
      if (typeof parsed.buy_notice_en === 'string') {
        buy_notice_en = parsed.buy_notice_en;
      }
    } catch {
      // Ignore
    }
    delete socialLinks.__buy_notice_meta;
  }

  return {
    ...settingsRow,
    social_links: socialLinks,
    buy_notice_enabled,
    buy_notice_ar,
    buy_notice_en,
  };
}

export async function fetchSettings(): Promise<StoreSettings> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_SETTINGS;
  }

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...extractBuyNoticeConfig(data),
  };
}

export async function updateSettings(
  settingsData: Partial<StoreSettings>
): Promise<StoreSettings> {
  const { client } = await requireVerifiedAdminClient();

  const socialLinksToSave: Record<string, any> = {
    ...(settingsData.social_links || {}),
    __buy_notice_meta: JSON.stringify({
      buy_notice_enabled: settingsData.buy_notice_enabled !== false,
      buy_notice_ar: settingsData.buy_notice_ar ?? DEFAULT_SETTINGS.buy_notice_ar,
      buy_notice_en: settingsData.buy_notice_en ?? DEFAULT_SETTINGS.buy_notice_en,
    }),
  };

  const dbPayload: Record<string, any> = {
    usd_rate: Number(settingsData.usd_rate) || 50,
    whatsapp_number: settingsData.whatsapp_number ?? '',
    whatsapp_default_message: settingsData.whatsapp_default_message ?? '',
    author_name: settingsData.author_name ?? '',
    author_bio_ar: settingsData.author_bio_ar ?? '',
    author_bio_en: settingsData.author_bio_en ?? '',
    author_photo: settingsData.author_photo ?? '',
    author_followers_text_ar: settingsData.author_followers_text_ar ?? '',
    author_followers_text_en: settingsData.author_followers_text_en ?? '',
    contact_email: settingsData.contact_email ?? '',
    social_links: socialLinksToSave,
    general_faq: Array.isArray(settingsData.general_faq) ? settingsData.general_faq : [],
  };

  const { data, error } = await client
    .from('settings')
    .update(dbPayload)
    .eq('id', 1)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update store settings');
  }

  return {
    ...DEFAULT_SETTINGS,
    ...extractBuyNoticeConfig(data),
  };
}

export const updateStoreSettings = updateSettings;

// ==========================================
// Server-Side Admin Image Upload Proxy (TASK-005)
// ==========================================
export async function uploadImageToImgBB(file: File): Promise<string> {
  const { token } = await requireVerifiedAdminClient();

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/admin/upload-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      imageBase64: base64,
      name: file.name,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.url) {
    throw new Error(result?.error || 'Image upload failed via server proxy');
  }

  return result.url;
}

// ==========================================
// Server-Validated Order Checkout Creation (TASK-003)
// ==========================================
export interface CreateCheckoutOrderInput {
  product_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  website_url?: string;
}

export interface CreateCheckoutOrderResponse {
  order_id: string;
  amount_egp: number;
  currency: 'EGP';
  redirect_url: string;
}

export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput
): Promise<CreateCheckoutOrderResponse> {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to initialize checkout order');
  }

  return data as CreateCheckoutOrderResponse;
}

// ==========================================
// AI Shopping Assistant Orchestration (TASK-008)
// ==========================================
export interface SendAssistantMessageParams {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  lang?: Lang;
  language?: Lang;
  conversationId?: string;
  sessionId?: string;
  page?: string;
  pathname?: string;
  context?: string;
}

export async function sendAssistantMessage(
  params: SendAssistantMessageParams
): Promise<AssistantResponsePayload> {
  const lang = params.lang || params.language || 'ar';
  return processAssistantTurn({
    message: params.message,
    history: params.history || [],
    lang,
    conversationId: params.conversationId,
    sessionId: params.sessionId,
    page: params.page || params.pathname,
    context: params.context,
  });
}
