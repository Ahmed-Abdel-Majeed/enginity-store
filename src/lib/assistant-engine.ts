import {
  AssistantProductRecommendation,
  AssistantResponsePayload,
  AssistantRouteType,
  AssistantRoutingTrace,
  Lang,
  Product
} from '../types';
import { fetchProducts } from './data-store';
import { resolveProductPricing } from './utils';

const SITE_BASE_URL = (
  (typeof process !== 'undefined' && (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL)) ||
  'https://enginity-store-s8dx.vercel.app'
)
  .replace(/\/+$/, '')
  .replace(/\/(ar|en)$/, '');

export const DEFAULT_N8N_WEBHOOK_URL =
  'https://n8n-enginity.duckdns.org/webhook/agent-enginity-store';

/**
 * 0. Arabic & English Text and Alias Normalization
 * Normalizes Arabic letter variants, strips diacritics/tatweel, and expands common spelling aliases.
 */
export function normalizeCatalogText(input: string): string {
  if (!input) return '';
  let s = input
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Strip tashkeel & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');

  // Normalize common Arabic & English spelling variants into canonical tokens alongside original text
  const aliasReplacements: Array<[RegExp, string]> = [
    [/(مسنجر|ماسينجر|مسينجر|مماسنجر|الماسنجر|المسنجر|ماسنجر)/g, ' ماسنجر messenger '],
    [/(?:^|[\s،,.؟!()/-])(?:لل|ل|ب|ف|ك)?(فيسبوك|فيس بوك|الفيسبوك|الفيس|ميتا)(?=$|[\s،,.؟!()/-])|\b(fb)\b/g, ' فيسبوك facebook messenger meta '],
    [/(واتساب|واتس اب|واتس آب|وتساب|واطساب|الواتساب|الواتس)|\b(watsapp|whatsap)\b/g, ' واتساب whatsapp '],
    [/(?:^|[\s،,.؟!()/-])(?:لل|ل|ب|ف|ك)?(واتس)(?=$|[\s،,.؟!()/-])/g, ' واتساب whatsapp '],
    [/(ايفولوشن|ايفوليشن)|\b(evolution)\b/g, ' evolution whatsapp '],
    [/(شات بوت|تشات بوت|بوتات|بوت)/g, ' بوت chatbot bot '],
    [/(ذكاء اصطناعي|الذكاء الاصطناعي|ذكاء صناعي|الذكاء الصناعي)/g, ' ذكاء اصطناعي ai '],
    [/(اتمته|اتمتة|اوتوميشن|الاوتوميشن|الاتمته)/g, ' اتمته automation '],
    [/(شوبيفاي|شوبفاي)/g, ' شوبيفاي shopify '],
    [/(ووكومرس|وو كومرس|ووردبريس)/g, ' ووكومرس woocommerce '],
    [/(?:^|[\s،,.؟!()/-])(?:لل|ل|ب|ف|ك)?(سله|سلة)(?=$|[\s،,.؟!()/-])/g, ' سله salla '],
    [/(?:^|[\s،,.؟!()/-])(?:لل|ل|ب|ف|ك)?(اودو|أودو)(?=$|[\s،,.؟!()/-])/g, ' اودو odoo '],
    [/(تليجرام|تيليجرام|تلجرام)/g, ' تليجرام telegram '],
    [/(انستجرام|انستغرام|انستا)/g, ' انستجرام instagram '],
    [/(جوجل شيت|شيتات|شيت|جداول جوجل)/g, ' جوجل شيت google sheets '],
    [/(سي ار ام|اداره علاقات العملاء)/g, ' crm ']
  ];

  for (const [pattern, expansion] of aliasReplacements) {
    s = s.replace(pattern, expansion);
  }

  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 1. Read-only Catalog Retrieval Tool (T030)
 * Fetches only public-facing ('published' and 'coming_soon') products from Supabase.
 * Never exposes admin_notes, internal customer emails, or draft/archived products.
 */
export async function searchLiveCatalog(
  query?: string,
  options?: { throwOnError?: boolean }
): Promise<Product[]> {
  const allPublicProducts = (
    await fetchProducts({ publishedOnly: true, throwOnError: options?.throwOnError })
  ).filter(p => p.status === 'published' || p.status === 'coming_soon');

  if (!query || !query.trim()) {
    return allPublicProducts;
  }

  const normQuery = normalizeCatalogText(query);
  const tokens = normQuery.split(/\s+/).filter(t => t.length >= 2);

  const scored = allPublicProducts.map(product => {
    const rawHaystack = [
      product.name_ar,
      product.name_en,
      product.slug,
      product.short_ar || '',
      product.short_en || '',
      product.description_ar || '',
      product.description_en || '',
      ...(product.tools || []),
      ...(product.includes_ar || []),
      ...(product.includes_en || [])
    ].join(' ');

    const haystack = normalizeCatalogText(rawHaystack);

    let score = 0;
    if (haystack.includes(normQuery)) score += 12;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 3;
    }

    if (
      (normQuery.includes('whatsapp') || normQuery.includes('واتساب')) &&
      (haystack.includes('whatsapp') || haystack.includes('واتساب'))
    ) {
      score += 15;
    }
    if (
      (normQuery.includes('messenger') || normQuery.includes('ماسنجر') || normQuery.includes('facebook')) &&
      (haystack.includes('messenger') || haystack.includes('ماسنجر'))
    ) {
      score += 15;
    }

    return { product, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter(s => s.score > 0).map(s => s.product);
  return matched.length > 0 ? matched : allPublicProducts;
}

/**
 * 2. Strict Catalog Validator (Anti-Hallucination Guardrail)
 * Ensures every recommended product card strictly matches an actual product in the live catalog,
 * enforcing accurate IDs, slugs, names, EGP prices, availability statuses, tools, and URLs.
 */
export function buildVerifiedRecommendation(
  product: Product,
  reasonAr?: string,
  reasonEn?: string,
  limitationsAr?: string,
  limitationsEn?: string
): AssistantProductRecommendation {
  const status: 'published' | 'coming_soon' =
    product.status === 'coming_soon' ? 'coming_soon' : 'published';

  const toolsTextAr = (product.tools || []).join('، ');
  const toolsTextEn = (product.tools || []).join(', ');

  const pricing = resolveProductPricing(product);
  const priceTextAr = pricing.hasDiscount
    ? `${pricing.effectivePriceEgp} ج.م بدلاً من ${pricing.originalPriceEgp} ج.م (خصم ${pricing.discountPercentage}%)`
    : `${pricing.effectivePriceEgp} ج.م`;
  const priceTextEn = pricing.hasDiscount
    ? `${pricing.effectivePriceEgp} EGP instead of ${pricing.originalPriceEgp} EGP (${pricing.discountPercentage}% OFF)`
    : `${pricing.effectivePriceEgp} EGP`;

  const defaultReasonAr =
    status === 'published'
      ? `${product.short_ar || product.name_ar} — متاح للشراء والتحميل الفوري بسعر ${priceTextAr}${toolsTextAr ? ` (يعمل باستخدام: ${toolsTextAr})` : ''}.`
      : `${product.short_ar || product.name_ar} — قريباً في المتجر (Coming Soon) بسعر متوقع ${priceTextAr}. يمكنك الانضمام لقائمة الانتظار ليصلك تنبيه فور إطلاقه.`;

  const defaultReasonEn =
    status === 'published'
      ? `${product.short_en || product.name_en} — Available for instant purchase & download at ${priceTextEn}${toolsTextEn ? ` (powered by: ${toolsTextEn})` : ''}.`
      : `${product.short_en || product.name_en} — Coming Soon (expected price ${priceTextEn}). You can join the waitlist to get notified the moment it launches.`;

  const reqNamesAr = (product.requirements_ar || []).map(r => r.name).filter(Boolean);
  const reqNamesEn = (product.requirements_en || []).map(r => r.name).filter(Boolean);

  const defaultLimitAr =
    reqNamesAr.length > 0
      ? `المتطلبات الأساسية للتشغيل: ${reqNamesAr.join(' + ')}.`
      : `يتطلب بيئة عمل n8n وإعداد حسابات الربط (${(product.tools || []).slice(0, 4).join(' + ') || 'n8n'}).`;

  const defaultLimitEn =
    reqNamesEn.length > 0
      ? `Prerequisites: ${reqNamesEn.join(' + ')}.`
      : `Requires an active n8n instance and API credentials for ${(product.tools || []).slice(0, 4).join(' + ') || 'n8n'}.`;

  return {
    product_id: product.id,
    slug: product.slug,
    name_ar: product.name_ar,
    name_en: product.name_en,
    short_ar: product.short_ar || product.name_ar,
    short_en: product.short_en || product.name_en,
    price_egp: pricing.effectivePriceEgp,
    original_price_egp: pricing.originalPriceEgp,
    sale_price_egp: pricing.salePriceEgp,
    discount_percentage: pricing.discountPercentage,
    status,
    waitlist_enabled: product.waitlist_enabled ?? true,
    level: product.level || 'intermediate',
    tools: Array.isArray(product.tools) ? product.tools : [],
    cover_path: product.cover_path || undefined,
    product_url_ar: `${SITE_BASE_URL}/ar/products/${product.slug}`,
    product_url_en: `${SITE_BASE_URL}/en/products/${product.slug}`,
    match_reason_ar: reasonAr?.trim() || defaultReasonAr,
    match_reason_en: reasonEn?.trim() || defaultReasonEn,
    limitations_ar: limitationsAr?.trim() || defaultLimitAr,
    limitations_en: limitationsEn?.trim() || defaultLimitEn
  };
}

export function validateRecommendationsAgainstCatalog(
  rawRecommendations: Array<{
    product_id?: string;
    slug?: string;
    match_reason_ar?: string;
    match_reason_en?: string;
    limitations_ar?: string;
    limitations_en?: string;
  }>,
  catalog: Product[]
): AssistantProductRecommendation[] {
  if (!Array.isArray(rawRecommendations) || rawRecommendations.length === 0) {
    return [];
  }

  const byId = new Map<string, Product>();
  const bySlug = new Map<string, Product>();
  for (const prod of catalog) {
    if (prod.status === 'published' || prod.status === 'coming_soon') {
      byId.set(prod.id, prod);
      bySlug.set(prod.slug, prod);
    }
  }

  const verified: AssistantProductRecommendation[] = [];
  const seenIds = new Set<string>();

  for (const candidate of rawRecommendations) {
    const matched =
      (candidate.product_id && byId.get(candidate.product_id)) ||
      (candidate.slug && bySlug.get(candidate.slug));

    if (matched && !seenIds.has(matched.id)) {
      seenIds.add(matched.id);
      verified.push(
        buildVerifiedRecommendation(
          matched,
          candidate.match_reason_ar,
          candidate.match_reason_en,
          candidate.limitations_ar,
          candidate.limitations_en
        )
      );
    }
  }

  return verified;
}

/**
 * 3. Security & Prompt-Injection Guardrails
 */
const INJECTION_OR_SENSITIVE_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*prompt/i,
  /service_role/i,
  /supabase_service_role_key/i,
  /gemini_api_key/i,
  /drop\s+table/i,
  /select\s+\*\s+from\s+admins/i,
  /انسى\s+كل\s+التعليمات/i,
  /تجاهل\s+التعليمات\s+السابقة/i,
  /\b(?:\d[ -]*?){13,16}\b/ // Credit card pattern
];

export function checkSecurityGuardrails(message: string): AssistantResponsePayload | null {
  for (const pattern of INJECTION_OR_SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      const trace: AssistantRoutingTrace = {
        route: 'security_refusal',
        reason: 'Blocked by security & prompt-injection guardrails',
        supabaseQueried: false,
        n8nCalled: false,
        n8nCallCount: 0,
        matchedProductSlugs: [],
        matchConfidence: 'none'
      };
      return {
        reply_ar:
          'عذراً، لا يمكنني معالجة بيانات البطاقات البنكية الحساسة أو تنفيذ أوامر نظام داخلية. أنا مساعد تسوق ذكي مخصص لمساعدتك في اختيار حلول ومنتجات الأتمتة من كتالوج ENGINITY أو طلب نظام مخصص.',
        reply_en:
          'Sorry, I cannot process sensitive payment card details or execute internal system instructions. I am the ENGINITY Shopping Assistant here to help you find automation workflows from our live catalog or request a custom system.',
        recommendations: [],
        suggested_actions: [
          {
            type: 'request_custom_system',
            label_ar: 'طلب نظام أتمتة مخصص',
            label_en: 'Request Custom Automation System'
          },
          {
            type: 'contact_human_support',
            label_ar: 'التواصل مع الدعم الفني',
            label_en: 'Contact Human Support'
          }
        ],
        source_mode: 'catalog_intelligence',
        route: 'security_refusal',
        routing_trace: trace
      };
    }
  }
  return null;
}

/**
 * 4. Explicit Intent Detection & Routing Analysis
 */
export interface DetectedUserIntent {
  normalizedMessage: string;
  isSecurityViolation: boolean;
  isExplicitNoMatchFeedback: boolean;
  isGeneralAgentConversation: boolean;
  isAmbiguousProductQuery: boolean;
  requestedPlatforms: string[];
  requestedCapabilities: string[];
  hasUnsupportedCapability: boolean;
  intentReason: string;
}

const PLATFORM_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { id: 'messenger', regex: /\b(messenger|facebook|meta)\b|(ماسنجر|فيسبوك)/i },
  { id: 'whatsapp', regex: /\b(whatsapp|evolution)\b|(واتساب|ايفولوشن)/i },
  { id: 'shopify', regex: /\b(shopify)\b|(شوبيفاي)/i },
  { id: 'woocommerce', regex: /\b(woocommerce|wordpress)\b|(ووكومرس|ووردبريس)/i },
  { id: 'salla', regex: /\b(salla)\b|(سله)/i },
  { id: 'zid', regex: /\b(zid)\b|(\bزد\b)/i },
  { id: 'odoo', regex: /\b(odoo)\b|(اودو)/i },
  { id: 'erp', regex: /\b(erp|accounting|invoicing|tax\s+invoice)\b|(اي ار بي|محاسبه|فواتير ضريبيه)/i },
  { id: 'slack', regex: /\b(slack)\b|(سلاك)/i },
  { id: 'telegram', regex: /\b(telegram)\b|(تليجرام)/i },
  { id: 'instagram', regex: /\b(instagram)\b|(انستجرام)/i },
  { id: 'tiktok', regex: /\b(tiktok)\b|(تيك توك)/i },
  { id: 'real_estate', regex: /\b(real\s+estate)\b|(عقارات|تسويق عقاري)/i },
  { id: 'mobile_app', regex: /\b(mobile\s+app|android|ios)\b|(تطبيق موبايل|تطبيق اندرويد|تطبيق ايفون)/i }
];

const CAPABILITY_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  {
    id: 'ai_chatbot',
    regex: /\b(ai|chatbot|bot|gemini|openai|gpt|claude|openrouter|auto\s*reply|customer\s*support)\b|(ذكاء اصطناعي|بوت|رد تلقائي|يرد علي|يرد تلقائي|خدمه عملاء)/i
  },
  {
    id: 'human_takeover',
    regex: /\b(human\s*takeover|human\s*handoff|team\s*replies|agent\s*takeover)\b|(تدخل بشري|تحويل بشري|موظف يرد|يسكت لما موظف)/i
  },
  {
    id: 'sheets_leads',
    regex: /\b(google\s*sheets?|spreadsheet|leads?|csv)\b|(جوجل شيت|جدول بيانات|بيانات العملاء|يسجل بيانات)/i
  },
  {
    id: 'email_confirmation',
    regex: /\b(gmail|confirmation\s*email|email\s*notification)\b|(جيميل|ايميل تاكيد|بريد الكتروني)/i
  },
  {
    id: 'voice_media',
    regex: /\b(voice\s*notes?|audio|elevenlabs|images?)\b|(رسائل صوتيه|فويس|صوت|صور)/i
  },
  {
    id: 'crm',
    regex: /\b(crm|hubspot|salesforce|zoho|pipedrive)\b|(سي ار ام|اداره علاقات العملاء)/i
  },
  {
    id: 'booking_clinic',
    regex: /\b(booking|appointments?|clinic|calendar|schedule)\b|(حجز|مواعيد|عياده|عيادات|دكتور|طبي|تقويم)/i
  }
];

const UNSUPPORTED_CAPABILITY_REGEX =
  /\b(phone\s*calls?|voice\s*call\s*center|tax\s*invoices?|payment\s*gateway\s*integration|inventory\s*sync)\b|(مكالمات هاتفيه|كول سنتر صوتي|اصدار فواتير ضريبيه|فواتير ضريبيه|ربط مخزون)/i;

const EXPLICIT_NO_MATCH_FEEDBACK_REGEX =
  /(ولا نظام من دول مناسب|ولا واحد مناسب|غير مناسب لاحتياجي|مافيش نظام مناسب|none of these are suitable|none of these fit)/i;

const EDUCATIONAL_OR_CONCEPTUAL_REGEX =
  /(ايه الفرق بين|ما الفرق بين|ما هو الفرق بين|اشرحلي|اشرح لي|ازاي ابدا في مجال|كيف ابدا في مجال|يعني ايه|ما معني|ما هو مفهوم|what is the difference between|difference between|explain how to start|how do i start in|how to learn|what does .* mean)/i;

const PRODUCT_ACQUISITION_INTENT_REGEX =
  /(عايز|عاوز|محتاج|اريد|ابغي|عندكم|عندكو|هل يوجد|هل في|هل لديكم|في بوت|فيه بوت|بكام|سعر|اسعار|شراء|اشتري|رشحلي|ترشيح|قائمه الانتظار|ورك فلو|وورك فلو|قالب|منتج|منتجات|نظام|بوت|اتمته|محتاج مساعده|ساعدني اختار|كيف اختار النظام|i need|i want|looking for|do you have|is there a|show me|recommend|price|cost|how much|buy|workflow|template|product|products|chatbot|bot|help me choose)/i;

const PURE_GREETING_OR_CHITCHAT_REGEX =
  /^(اهلا|اهلا وسهلا|اهلا عامل ايه|اهلا، عامل ايه\??|السلام عليكم|وعليكم السلام|مرحبا|صباح الخير|مساء الخير|ازيك|عامل ايه|اخبارك ايه|من انتم|مين انت|شكرا|شكرا جزيلا|hello|hi|hey|good morning|good evening|how are you|hello,? how can you help me\??|who are you|thanks|thank you)[!?.،؟\s]*$/i;

export function detectUserIntent(rawMessage: string): DetectedUserIntent {
  const normalizedMessage = normalizeCatalogText(rawMessage);
  const rawTrimmed = rawMessage.trim();

  const isSecurityViolation = INJECTION_OR_SENSITIVE_PATTERNS.some(p => p.test(rawTrimmed));
  if (isSecurityViolation) {
    return {
      normalizedMessage,
      isSecurityViolation: true,
      isExplicitNoMatchFeedback: false,
      isGeneralAgentConversation: false,
      isAmbiguousProductQuery: false,
      requestedPlatforms: [],
      requestedCapabilities: [],
      hasUnsupportedCapability: false,
      intentReason: 'Security or prompt-injection pattern matched'
    };
  }

  const isExplicitNoMatchFeedback = EXPLICIT_NO_MATCH_FEEDBACK_REGEX.test(normalizedMessage);

  const requestedPlatforms = PLATFORM_PATTERNS.filter(p =>
    p.regex.test(normalizedMessage)
  ).map(p => p.id);

  const requestedCapabilities = CAPABILITY_PATTERNS.filter(c =>
    c.regex.test(normalizedMessage)
  ).map(c => c.id);

  const hasUnsupportedCapability = UNSUPPORTED_CAPABILITY_REGEX.test(normalizedMessage);

  const isPureGreeting =
    requestedPlatforms.length === 0 &&
    requestedCapabilities.length === 0 &&
    PURE_GREETING_OR_CHITCHAT_REGEX.test(normalizedMessage);

  const isEducationalQuestion =
    requestedPlatforms.length === 0 &&
    EDUCATIONAL_OR_CONCEPTUAL_REGEX.test(normalizedMessage) &&
    !/(عندكم|عايز بوت|محتاج بوت|هل يوجد|شراء|سعر|بكام|do you have|show me|buy)/.test(
      normalizedMessage
    );

  const isGeneralAgentConversation =
    !isExplicitNoMatchFeedback && (isPureGreeting || isEducationalQuestion);

  const hasAcquisitionSignal = PRODUCT_ACQUISITION_INTENT_REGEX.test(normalizedMessage);

  // Ambiguous product request: user wants a bot / automation / help choosing a system,
  // but hasn't specified any platform or specific unique product capability
  const hasSpecificCatalogCapability = requestedCapabilities.some(c =>
    ['human_takeover', 'sheets_leads', 'email_confirmation', 'voice_media'].includes(c)
  );

  const isAmbiguousProductQuery =
    !isGeneralAgentConversation &&
    !isExplicitNoMatchFeedback &&
    !hasUnsupportedCapability &&
    requestedPlatforms.length === 0 &&
    !hasSpecificCatalogCapability &&
    (hasAcquisitionSignal ||
      requestedCapabilities.includes('ai_chatbot') ||
      requestedCapabilities.includes('booking_clinic'));

  let intentReason = 'Product or catalog inquiry';
  if (isExplicitNoMatchFeedback) {
    intentReason = 'Customer indicated existing catalog items do not fit their needs';
  } else if (isPureGreeting) {
    intentReason = 'Greeting or social conversation routed to general AI agent';
  } else if (isEducationalQuestion) {
    intentReason = 'Conceptual or educational question routed to general AI agent';
  } else if (hasUnsupportedCapability) {
    intentReason = 'Requested capability is not supported by ready-made templates';
  } else if (requestedPlatforms.length > 0) {
    intentReason = `Product discovery for platform(s): ${requestedPlatforms.join(', ')}`;
  } else if (requestedCapabilities.includes('crm')) {
    intentReason = 'CRM system inquiry evaluated against catalog capabilities';
  } else if (isAmbiguousProductQuery) {
    intentReason = 'Ambiguous product/bot request requiring clarification of platform and goal';
  }

  return {
    normalizedMessage,
    isSecurityViolation: false,
    isExplicitNoMatchFeedback,
    isGeneralAgentConversation,
    isAmbiguousProductQuery,
    requestedPlatforms,
    requestedCapabilities,
    hasUnsupportedCapability,
    intentReason
  };
}

/**
 * Helper to inspect which platforms & capabilities an actual Supabase Product supports
 */
function inspectProductCapabilities(product: Product): {
  platforms: Set<string>;
  capabilities: Set<string>;
  normalizedCorpus: string;
} {
  const primaryPlatformCorpus = normalizeCatalogText(
    [
      product.name_ar,
      product.name_en,
      product.slug,
      product.short_ar || '',
      product.short_en || '',
      ...(product.tools || [])
    ].join(' ')
  );

  const rawCorpus = [
    product.name_ar,
    product.name_en,
    product.slug,
    product.short_ar || '',
    product.short_en || '',
    product.description_ar || '',
    product.description_en || '',
    ...(product.tools || []),
    ...(product.includes_ar || []),
    ...(product.includes_en || [])
  ].join(' ');

  const normalizedCorpus = normalizeCatalogText(rawCorpus);
  const platforms = new Set<string>();
  const capabilities = new Set<string>();

  for (const p of PLATFORM_PATTERNS) {
    if (p.regex.test(primaryPlatformCorpus)) {
      platforms.add(p.id);
    }
  }
  for (const c of CAPABILITY_PATTERNS) {
    if (c.regex.test(normalizedCorpus)) {
      capabilities.add(c.id);
    }
  }

  return { platforms, capabilities, normalizedCorpus };
}

/**
 * 5. Local Catalog Discovery & Capability Matching Engine (Routes: catalog, clarification, no_match)
 */
export function runCatalogIntelligenceEngine(
  userMessage: string,
  catalog: Product[],
  _lang: Lang = 'ar'
): AssistantResponsePayload {
  const msg = userMessage.trim();
  const intent = detectUserIntent(msg);

  const publicCatalog = catalog.filter(
    p => p.status === 'published' || p.status === 'coming_soon'
  );

  const annotatedCatalog = publicCatalog.map(product => ({
    product,
    ...inspectProductCapabilities(product)
  }));

  // -------------------------------------------------------------------------
  // ROUTE D1: Explicit "None of these are suitable" feedback -> no_match
  // -------------------------------------------------------------------------
  if (intent.isExplicitNoMatchFeedback) {
    const trace: AssistantRoutingTrace = {
      route: 'no_match',
      reason: intent.intentReason,
      supabaseQueried: true,
      n8nCalled: false,
      n8nCallCount: 0,
      matchedProductSlugs: [],
      matchConfidence: 'none'
    };
    return {
      reply_ar:
        'أفهمك تماماً! طالما أن الأنظمة الجاهزة الحالية لا تطابق دورة عملك بالكامل، يمكنك فوراً اختيار أحد المسارين التاليين:\n1. **طلب نظام أتمتة مخصص**: سيقوم مهندس الأتمتة ببناء Workflow مفصّل خصيصاً لمتطلبات شركتك.\n2. **اقتراح منتج جديد للمتجر**: لإضافته ضمن خطة القوالب القادمة وإشعارك فور طرحه.',
      reply_en:
        'Completely understood! Since the current ready-made workflows do not match your exact needs, you can immediately choose one of these paths:\n1. **Request a Custom Automation System**: Our automation engineer will design and build a tailored workflow for your business.\n2. **Suggest a New Product**: Submit your idea for our upcoming marketplace releases.',
      recommendations: [],
      suggested_actions: [
        {
          type: 'request_custom_system',
          label_ar: 'طلب نظام أتمتة مخصص لشركتي',
          label_en: 'Request Custom Automation System',
          prefill_topic: msg
        },
        {
          type: 'suggest_product',
          label_ar: 'اقتراح منتج جديد للمتجر',
          label_en: 'Suggest New Store Product',
          prefill_topic: msg
        },
        {
          type: 'contact_human_support',
          label_ar: 'استشارة مباشرة عبر واتساب',
          label_en: 'Direct WhatsApp Consultation'
        }
      ],
      source_mode: 'catalog_intelligence',
      route: 'no_match',
      routing_trace: trace
    };
  }

  // -------------------------------------------------------------------------
  // Check platform matches against live catalog
  // -------------------------------------------------------------------------
  const matchedPlatformsInCatalog = intent.requestedPlatforms.filter(reqPlat =>
    annotatedCatalog.some(item => item.platforms.has(reqPlat))
  );
  const unmatchedPlatforms = intent.requestedPlatforms.filter(
    reqPlat => !annotatedCatalog.some(item => item.platforms.has(reqPlat))
  );

  // -------------------------------------------------------------------------
  // ROUTE D2: Unsupported platform(s) or unsupported capabilities -> no_match
  // -------------------------------------------------------------------------
  if (
    intent.hasUnsupportedCapability ||
    (unmatchedPlatforms.length > 0 && matchedPlatformsInCatalog.length === 0)
  ) {
    const trace: AssistantRoutingTrace = {
      route: 'no_match',
      reason: intent.hasUnsupportedCapability
        ? 'Requested capability is not supported in current catalog'
        : `No product in catalog supports requested platform(s): ${unmatchedPlatforms.join(', ')}`,
      supabaseQueried: true,
      n8nCalled: false,
      n8nCallCount: 0,
      matchedProductSlugs: [],
      matchConfidence: 'none'
    };

    return {
      reply_ar:
        'لقد فحصت كتالوج منتجات ENGINITY الفعلي، ولا يوجد حالياً قالب جاهز يدعم هذه المنصة أو الميزة المطلوبة بشكل مباشر (المنتجات الجاهزة حالياً تركز على أتمتة فيسبوك ماسنجر وواتساب بالذكاء الاصطناعي مع التدخل البشري وربط Google Sheets).\n\nيمكنك اختيار أحد المسارين التاليين فوراً:\n1. **تقديم طلب نظام أتمتة مخصص**: سيقوم مهندس الأتمتة بدراسة متطلباتك وبناء الـ Workflow خصيصاً لشركتك.\n2. **اقتراح هذا المنتج للمتجر**: ليتم إضافته إلى خطة المنتجات القادمة وإبلاغك عند توفره.',
      reply_en:
        'I checked the live ENGINITY product catalog, and we do not currently have a ready-made workflow covering that specific platform or capability (our current catalog focuses on Facebook Messenger and WhatsApp AI automation with human takeover and Google Sheets).\n\nYou have two immediate options:\n1. **Request a Custom Automation System**: Our engineering team will review your requirements and build a tailored workflow for your business.\n2. **Suggest a New Marketplace Product**: Submit this idea so we can prioritize it for upcoming releases.',
      recommendations: [],
      suggested_actions: [
        {
          type: 'request_custom_system',
          label_ar: 'طلب بناء هذا النظام خصيصاً لي',
          label_en: 'Request Custom System Build',
          prefill_topic: msg
        },
        {
          type: 'suggest_product',
          label_ar: 'اقتراح إضافة هذا المنتج للمتجر',
          label_en: 'Suggest as a New Store Product',
          prefill_topic: msg
        },
        {
          type: 'contact_human_support',
          label_ar: 'استشارة سريعة عبر واتساب',
          label_en: 'Quick WhatsApp Consultation'
        }
      ],
      source_mode: 'catalog_intelligence',
      route: 'no_match',
      routing_trace: trace
    };
  }

  // -------------------------------------------------------------------------
  // ROUTE C1: CRM Inquiry (Partial capability in catalog -> Clarification + Catalog options)
  // -------------------------------------------------------------------------
  if (
    intent.requestedCapabilities.includes('crm') &&
    matchedPlatformsInCatalog.length === 0
  ) {
    const hasStandaloneCrm = annotatedCatalog.some(item => item.capabilities.has('crm'));
    if (!hasStandaloneCrm) {
      const sheetProducts = annotatedCatalog
        .filter(item => item.capabilities.has('sheets_leads'))
        .map(item =>
          buildVerifiedRecommendation(
            item.product,
            `يقوم بتسجيل بيانات العملاء وتفاصيل المحادثات تلقائياً في Google Sheets كقاعدة بيانات عملاء مبسطة (${item.product.price_egp} ج.م — ${item.product.status === 'published' ? 'متاح الآن' : 'قريباً'}).`,
            `Automatically logs customer leads and conversation details to Google Sheets as a lightweight lead tracker (${item.product.price_egp} EGP — ${item.product.status === 'published' ? 'Available Now' : 'Coming Soon'}).`,
            'يسجل البيانات في Google Sheets ولا يمثل نظام CRM مستقل كامل مثل HubSpot أو Odoo.',
            'Logs leads to Google Sheets rather than acting as a standalone full CRM like HubSpot or Odoo.'
          )
        );

      const trace: AssistantRoutingTrace = {
        route: 'clarification',
        reason: 'CRM requested; catalog offers Google Sheets lead logging inside chatbots but no standalone CRM',
        supabaseQueried: true,
        n8nCalled: false,
        n8nCallCount: 0,
        matchedProductSlugs: sheetProducts.map(r => r.slug),
        matchConfidence: 'partial'
      };

      return {
        reply_ar:
          'لا يوجد حالياً نظام CRM مستقل بالكامل في الكتالوج، ولكن أنظمة الشات بوت الجاهزة لدينا (للماسنجر وواتساب) تتضمن ميزة **تسجيل بيانات العملاء تلقائياً في Google Sheets** كـ CRM مبسط.\n\nلتوجيهك للحل الأدق، يرجى توضيح:',
        reply_en:
          'We do not currently have a standalone full CRM in the catalog, but our ready-made Messenger and WhatsApp AI chatbots include **automatic customer lead logging to Google Sheets** as a lightweight CRM.\n\nTo guide you to the right solution, could you clarify:',
        clarifying_questions_ar: [
          'هل يكفيك شات بوت ذكي (ماسنجر أو واتساب) يسجل بيانات العملاء تلقائياً في Google Sheets؟',
          'أم أنك تستخدم نظام CRM خارجي (مثل HubSpot أو Zoho أو Odoo) وتريد ربطه عبر نظام أتمتة مخصص؟'
        ],
        clarifying_questions_en: [
          'Would an AI chatbot (Messenger or WhatsApp) that automatically saves customer leads to Google Sheets fit your need?',
          'Or do you need a custom integration with a dedicated CRM platform (such as HubSpot, Zoho, or Odoo)?'
        ],
        recommendations: sheetProducts,
        suggested_actions: [
          ...sheetProducts.map(r => ({
            type: (r.status === 'coming_soon' ? 'join_waitlist' : 'view_product') as
              | 'join_waitlist'
              | 'view_product',
            label_ar:
              r.status === 'coming_soon'
                ? `انضم لقائمة الانتظار (${r.name_ar.split('—')[0].trim()})`
                : `عرض تفاصيل وشراء (${r.price_egp} ج.م)`,
            label_en:
              r.status === 'coming_soon'
                ? `Join Waitlist (${r.name_en.split('—')[0].trim()})`
                : `View & Buy (${r.price_egp} EGP)`,
            product_id: r.product_id,
            product_slug: r.slug
          })),
          {
            type: 'request_custom_system',
            label_ar: 'طلب ربط نظام CRM مخصص',
            label_en: 'Request Custom CRM Integration',
            prefill_topic: msg
          },
          {
            type: 'suggest_product',
            label_ar: 'اقتراح نظام CRM للمتجر',
            label_en: 'Suggest a CRM Product',
            prefill_topic: msg
          }
        ],
        source_mode: 'catalog_intelligence',
        route: 'clarification',
        routing_trace: trace
      };
    }
  }

  // -------------------------------------------------------------------------
  // ROUTE C2: Ambiguous Product / Bot / Help Request -> clarification
  // -------------------------------------------------------------------------
  if (intent.isAmbiguousProductQuery) {
    const topRecs = publicCatalog
      .slice(0, 2)
      .map(p => buildVerifiedRecommendation(p));

    const trace: AssistantRoutingTrace = {
      route: 'clarification',
      reason: intent.intentReason,
      supabaseQueried: true,
      n8nCalled: false,
      n8nCallCount: 0,
      matchedProductSlugs: topRecs.map(r => r.slug),
      matchConfidence: 'partial'
    };

    return {
      reply_ar:
        'أهلاً بك في مساعد ENGINITY الذكي! يمكنني ترشيح أنسب Workflow جاهز من كتالوج المتجر الفعلي أو توجيهك لطلب نظام أتمتة مخصص. حتى أرشح لك المنتج الأدق، هل يمكنك توضيح النقاط التالية؟',
      reply_en:
        'Welcome to the ENGINITY AI Shopping Assistant! I can recommend the best ready-made workflow from our live catalog or guide you to request a custom automation system. To give you the most accurate recommendation, could you clarify:',
      clarifying_questions_ar: [
        'ما هي المنصة الأساسية التي تريد أتمتتها (فيسبوك ماسنجر، واتساب، موقع إلكتروني، أو نظام داخلي)؟',
        'ما هو الهدف الرئيسي (الرد التلقائي بالذكاء الاصطناعي مع تدخل بشري، تسجيل بيانات العملاء في Google Sheets، أم ربط أدوات خاصة)؟',
        'هل لديك بيئة n8n جاهزة حالياً أم تحتاج مساعدة في الإعداد؟'
      ],
      clarifying_questions_en: [
        'Which primary channel or platform do you want to automate (Facebook Messenger, WhatsApp, website, or internal system)?',
        'What is your main goal (AI auto-replies with human takeover, saving leads to Google Sheets, or custom multi-tool integration)?',
        'Do you already have an active n8n instance or do you need setup assistance?'
      ],
      recommendations: topRecs,
      suggested_actions: [
        ...topRecs.map(r => ({
          type: (r.status === 'coming_soon' ? 'join_waitlist' : 'view_product') as
            | 'join_waitlist'
            | 'view_product',
          label_ar:
            r.status === 'coming_soon'
              ? `انضم لقائمة انتظار: ${r.name_ar.split('—')[0].trim()}`
              : `استعرض المنتج: ${r.name_ar.split('—')[0].trim()}`,
          label_en:
            r.status === 'coming_soon'
              ? `Join Waitlist: ${r.name_en.split('—')[0].trim()}`
              : `View Product: ${r.name_en.split('—')[0].trim()}`,
          product_id: r.product_id,
          product_slug: r.slug
        })),
        {
          type: 'request_custom_system',
          label_ar: 'طلب نظام أتمتة مخصص لشركتك',
          label_en: 'Request a Custom Automation System',
          prefill_topic: msg
        }
      ],
      source_mode: 'catalog_intelligence',
      route: 'clarification',
      routing_trace: trace
    };
  }

  // -------------------------------------------------------------------------
  // ROUTE A: Specific Product Discovery against Live Catalog
  // -------------------------------------------------------------------------
  const scoredProducts = annotatedCatalog.map(item => {
    let score = 0;

    for (const reqPlat of matchedPlatformsInCatalog) {
      if (item.platforms.has(reqPlat)) {
        score += 25;
      }
    }

    for (const reqCap of intent.requestedCapabilities) {
      if (item.capabilities.has(reqCap)) {
        score += 10;
      }
    }

    const queryTokens = intent.normalizedMessage.split(/\s+/).filter(t => t.length >= 3);
    for (const token of queryTokens) {
      if (item.normalizedCorpus.includes(token)) {
        score += 2;
      }
    }

    return { ...item, score };
  });

  scoredProducts.sort((a, b) => b.score - a.score);

  let selectedItems = scoredProducts.filter(s => s.score > 0);
  if (matchedPlatformsInCatalog.length > 0) {
    selectedItems = selectedItems.filter(item =>
      matchedPlatformsInCatalog.some(plat => item.platforms.has(plat))
    );
  }

  if (selectedItems.length === 0) {
    // No product in catalog matched any token or capability
    const trace: AssistantRoutingTrace = {
      route: 'no_match',
      reason: 'No catalog products matched the requested criteria',
      supabaseQueried: true,
      n8nCalled: false,
      n8nCallCount: 0,
      matchedProductSlugs: [],
      matchConfidence: 'none'
    };

    return {
      reply_ar:
        'لقد بحثت في كتالوج ENGINITY الحالي ولم أجد منتجاً جاهزاً يطابق هذا الطلب بشكل مباشر. يمكنك طلب بناء هذا النظام خصيصاً لك أو اقتراح إضافته للمتجر:',
      reply_en:
        'I searched the live ENGINITY catalog and could not find a ready-made product that directly matches this request. You can request a custom automation build or suggest it as a new store product:',
      recommendations: [],
      suggested_actions: [
        {
          type: 'request_custom_system',
          label_ar: 'طلب نظام أتمتة مخصص',
          label_en: 'Request Custom Automation System',
          prefill_topic: msg
        },
        {
          type: 'suggest_product',
          label_ar: 'اقتراح منتج جديد للمتجر',
          label_en: 'Suggest a New Product',
          prefill_topic: msg
        },
        {
          type: 'contact_human_support',
          label_ar: 'استشارة سريعة عبر واتساب',
          label_en: 'Quick WhatsApp Consultation'
        }
      ],
      source_mode: 'catalog_intelligence',
      route: 'no_match',
      routing_trace: trace
    };
  }

  // Build verified recommendation cards from the matched database records
  const rawCandidates = selectedItems.map(item => {
    const p = item.product;
    const isComingSoon = p.status === 'coming_soon';
    const isMessenger = item.platforms.has('messenger');
    const isWhatsApp = item.platforms.has('whatsapp');

    let reasonAr = '';
    let reasonEn = '';
    let limitAr = '';
    let limitEn = '';

    if (isMessenger) {
      reasonAr = `${p.short_ar || p.name_ar} — السعر الفعلي: ${p.price_egp} ج.م (${isComingSoon ? 'قريباً في المتجر' : 'متاح للشراء والتحميل الفوري'}).`;
      reasonEn = `${p.short_en || p.name_en} — Price: ${p.price_egp} EGP (${isComingSoon ? 'Coming Soon' : 'Available for instant purchase'}).`;
      limitAr = `مخصص لفيسبوك ماسنجر ويعمل عبر ${(p.tools || []).join('، ')} (لا يشمل واتساب في نفس القالب).`;
      limitEn = `Designed for Facebook Messenger using ${(p.tools || []).join(', ')} (does not include WhatsApp in the same template).`;
    } else if (isWhatsApp) {
      reasonAr = isComingSoon
        ? `${p.short_ar || p.name_ar} — حالياً في مرحلة "قريباً (Coming Soon)" بسعر ${p.price_egp} ج.م. يمكنك الانضمام لقائمة الانتظار ليصلك فور إطلاقه.`
        : `${p.short_ar || p.name_ar} — السعر الفعلي: ${p.price_egp} ج.م (متاح للشراء والتحميل الفوري).`;
      reasonEn = isComingSoon
        ? `${p.short_en || p.name_en} — Currently "Coming Soon" at ${p.price_egp} EGP. Join the waitlist to get notified upon launch.`
        : `${p.short_en || p.name_en} — Price: ${p.price_egp} EGP (Available for instant purchase).`;
      limitAr = `يتطلب ربط رقم واتساب عبر Evolution API مع بيئة n8n (${(p.tools || []).join('، ')}).`;
      limitEn = `Requires linking your WhatsApp number via Evolution API with n8n (${(p.tools || []).join(', ')}).`;
    }

    return {
      product_id: p.id,
      slug: p.slug,
      match_reason_ar: reasonAr || undefined,
      match_reason_en: reasonEn || undefined,
      limitations_ar: limitAr || undefined,
      limitations_en: limitEn || undefined
    };
  });

  const recommendations = validateRecommendationsAgainstCatalog(rawCandidates, publicCatalog);

  // Check if partial match (e.g., user also mentioned an unverified capability like booking_clinic or an extra platform)
  const hasPartialExtra =
    unmatchedPlatforms.length > 0 ||
    (intent.requestedCapabilities.includes('booking_clinic') &&
      !selectedItems.some(i => i.capabilities.has('booking_clinic')));

  const matchConfidence: 'strong' | 'partial' = hasPartialExtra ? 'partial' : 'strong';

  const clarifyingQuestionsAr = hasPartialExtra
    ? [
        'القالب الجاهز يغطي الرد الذكي والتدخل البشري وحفظ بيانات العملاء في Google Sheets؛ هل ترغب في إضافة تخصيص إضافي (مثل ربط تقويم أو منصة أخرى)؟'
      ]
    : undefined;

  const clarifyingQuestionsEn = hasPartialExtra
    ? [
        'The ready-made workflow covers AI replies, human takeover, and Google Sheets lead logging; would you like custom extensions (such as calendar booking or an extra platform)?'
      ]
    : undefined;

  const hasComingSoon = recommendations.some(r => r.status === 'coming_soon');
  const hasPublished = recommendations.some(r => r.status === 'published');

  let replyAr = '';
  let replyEn = '';

  if (recommendations.length === 1 && recommendations[0].status === 'coming_soon') {
    const rec = recommendations[0];
    replyAr = `بناءً على طلبك، المنتج المطابق في كتالوج ENGINITY هو **${rec.name_ar}** بسعر **${rec.price_egp} ج.م**، وهو حالياً في حالة **"قريباً (Coming Soon)"**.\n\n• يمكنك **الانضمام لقائمة الانتظار** ليصلك إشعار فور إطلاقه.\n• أو يمكنك طلب بناء نظام مخصص إذا كنت بحاجة لتشغيله بشكل عاجل:`;
    replyEn = `Based on your request, the matching product in the ENGINITY catalog is **${rec.name_en}** (${rec.price_egp} EGP), which is currently **"Coming Soon"**.\n\n• You can **Join the Waitlist** to be notified immediately upon launch.\n• Or request a Custom Automation System if you need an urgent deployment:`;
  } else if (hasPublished && hasComingSoon) {
    replyAr = `وجدت لك الحلول المطابقة التالية في كتالوج ENGINITY الفعلي (تتضمن منتجاً متاحاً للشراء الفوري ومنتجاً قريباً يمكنك الانضمام لقائمة انتظاره):`;
    replyEn = `I found the following matching solutions in the live ENGINITY catalog (including an immediately available workflow and an upcoming product with waitlist access):`;
  } else {
    replyAr = `إليك المنتج المطابق لطلبك من كتالوج ENGINITY الفعلي، مع السعر الحقيقي ومتطلبات التشغيل:`;
    replyEn = `Here is the matching product from the live ENGINITY catalog, including its exact price, capabilities, and technical prerequisites:`;
  }

  const actions: AssistantResponsePayload['suggested_actions'] = [];
  for (const rec of recommendations) {
    if (rec.status === 'coming_soon') {
      actions.push({
        type: 'join_waitlist',
        label_ar: `انضم لقائمة الانتظار (${rec.name_ar.split('—')[0].trim()})`,
        label_en: `Join Waitlist (${rec.name_en.split('—')[0].trim()})`,
        product_id: rec.product_id,
        product_slug: rec.slug
      });
    } else {
      actions.push({
        type: 'view_product',
        label_ar: `عرض تفاصيل وشراء (${rec.price_egp} ج.م)`,
        label_en: `View & Buy (${rec.price_egp} EGP)`,
        product_id: rec.product_id,
        product_slug: rec.slug
      });
    }
  }

  actions.push({
    type: 'request_custom_system',
    label_ar: 'طلب نظام أتمتة مخصص',
    label_en: 'Request Custom Automation System',
    prefill_topic: msg
  });

  actions.push({
    type: 'suggest_product',
    label_ar: 'اقتراح منتج جديد للمتجر',
    label_en: 'Suggest a New Product',
    prefill_topic: msg
  });

  const trace: AssistantRoutingTrace = {
    route: 'catalog',
    reason: intent.intentReason,
    supabaseQueried: true,
    n8nCalled: false,
    n8nCallCount: 0,
    matchedProductSlugs: recommendations.map(r => r.slug),
    matchConfidence
  };

  return {
    reply_ar: replyAr,
    reply_en: replyEn,
    clarifying_questions_ar: clarifyingQuestionsAr,
    clarifying_questions_en: clarifyingQuestionsEn,
    recommendations,
    suggested_actions: actions,
    source_mode: 'catalog_intelligence',
    route: 'catalog',
    routing_trace: trace
  };
}

/**
 * 6. Explicit Retrieval Failure Handler (`catalog_error`)
 * Invoked when Supabase is unreachable or returns a query error during product discovery.
 * Never claims products were searched and never calls n8n unconditionally to fabricate products.
 */
function buildCatalogErrorResponse(userMessage: string, reason: string): AssistantResponsePayload {
  const trace: AssistantRoutingTrace = {
    route: 'catalog_error',
    reason,
    supabaseQueried: true,
    supabaseError: true,
    n8nCalled: false,
    n8nCallCount: 0,
    matchedProductSlugs: [],
    matchConfidence: 'none'
  };

  return {
    reply_ar:
      'عذراً، واجهت مشكلة تقنية مؤقتة أثناء الاتصال بقاعدة بيانات كتالوج المنتجات، لذلك لم أتمكن من فحص المنتجات المتاحة الآن. يرجى إعادة المحاولة بعد لحظات، أو يمكنك طلب نظام مخصص أو التواصل معنا مباشرة عبر واتساب.',
    reply_en:
      'Sorry, I encountered a temporary issue connecting to the product catalog database, so I could not verify available products right now. Please try again in a moment, or use the options below to request a custom system or contact support.',
    recommendations: [],
    suggested_actions: [
      {
        type: 'request_custom_system',
        label_ar: 'طلب نظام أتمتة مخصص',
        label_en: 'Request Custom Automation System',
        prefill_topic: userMessage
      },
      {
        type: 'contact_human_support',
        label_ar: 'التواصل عبر واتساب',
        label_en: 'Contact WhatsApp Support'
      }
    ],
    source_mode: 'catalog_intelligence',
    route: 'catalog_error',
    routing_trace: trace
  };
}

/**
 * 7. Main Orchestrator: processAssistantTurn (T031)
 * Enforces strict routing order:
 *   User Message -> Intent Detection -> Routing Decision -> Appropriate Handler -> Response Rendering
 *
 * - Route A (`catalog`): Queries Supabase, matches capabilities, validates records, 0 n8n calls.
 * - Route B (`general_agent`): Calls existing n8n webhook for greetings & general AI/automation questions.
 * - Route C (`clarification`): Asks concise clarifying questions locally for ambiguous product queries, 0 n8n calls.
 * - Route D (`no_match`): Explains limitations honestly and offers custom/suggestion actions, 0 n8n calls.
 * - `security_refusal`: Blocks prompt injection & sensitive data probing, 0 Supabase/n8n calls.
 * - `catalog_error`: Explicit retrieval failure handling when Supabase query fails, 0 n8n calls.
 */
export interface ProcessAssistantTurnParams {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  lang?: Lang;
  catalogOverride?: Product[];
  simulateProviderOutage?: boolean;
  conversationId?: string;
  sessionId?: string;
  page?: string;
  context?: string;
  // Optional injectable dependencies for deterministic unit & regression testing
  fetchCatalogFn?: (query?: string) => Promise<Product[]>;
  webhookFetchFn?: typeof fetch;
  webhookUrlOverride?: string;
}

export async function processAssistantTurn(
  params: ProcessAssistantTurnParams
): Promise<AssistantResponsePayload> {
  const userMessage = (params.message || '').trim().slice(0, 1500);
  const lang: Lang = params.lang === 'en' ? 'en' : 'ar';

  if (!userMessage) {
    const emptyTrace: AssistantRoutingTrace = {
      route: 'clarification',
      reason: 'Empty message input',
      supabaseQueried: false,
      n8nCalled: false,
      n8nCallCount: 0,
      matchedProductSlugs: [],
      matchConfidence: 'none'
    };
    return {
      reply_ar: 'يرجى كتابة سؤالك أو وصف المشكلة التي تريد أتمتتها وسأقوم بمساعدتك فوراً.',
      reply_en: 'Please type your question or describe the workflow you want to automate.',
      recommendations: [],
      suggested_actions: [
        {
          type: 'request_custom_system',
          label_ar: 'طلب نظام أتمتة مخصص',
          label_en: 'Request Custom System'
        }
      ],
      source_mode: 'catalog_intelligence',
      route: 'clarification',
      routing_trace: emptyTrace
    };
  }

  // Step 1: Security & Prompt-Injection Check
  const securityBlock = checkSecurityGuardrails(userMessage);
  if (securityBlock) {
    return securityBlock;
  }

  // Step 2: Intent Detection BEFORE deciding whether to query catalog or call n8n
  const intent = detectUserIntent(userMessage);

  // Step 3: Route B — General Conversation (`general_agent`) -> Call Server Proxy or n8n Webhook
  if (intent.isGeneralAgentConversation) {
    let n8nCallCount = 0;
    const isBrowser = typeof window !== 'undefined';
    const hasCustomOverride = Boolean(params.webhookUrlOverride || params.webhookFetchFn);

    const n8nAssistantUrl =
      params.webhookUrlOverride ||
      (isBrowser && !hasCustomOverride
        ? '/api/assistant/chat'
        : (typeof process !== 'undefined' && process.env?.N8N_ASSISTANT_WEBHOOK_URL) ||
          DEFAULT_N8N_WEBHOOK_URL);

    const fetchImpl = params.webhookFetchFn || fetch;
    const isAllowedTarget =
      n8nAssistantUrl.startsWith('https://') || n8nAssistantUrl.startsWith('/api/');

    if (!params.simulateProviderOutage && n8nAssistantUrl && isAllowedTarget) {
      try {
        n8nCallCount += 1;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const res = await fetchImpl(n8nAssistantUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(!isBrowser && typeof process !== 'undefined' && process.env?.N8N_ASSISTANT_SECRET
              ? { Authorization: `Bearer ${process.env.N8N_ASSISTANT_SECRET}` }
              : {})
          },
          body: JSON.stringify({
            message: userMessage,
            conversationId: params.conversationId || '',
            sessionId: params.sessionId || '',
            locale: lang,
            language: lang,
            page: params.page || '',
            pathname: params.page || '',
            context: params.context || 'Enginity Marketplace Customer Support',
            history: (params.history || []).slice(-6)
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (res.ok) {
          const textBody = await res.text();
          let json: any = null;
          try {
            json = JSON.parse(textBody);
          } catch {
            json = { reply: textBody };
          }

          const rawReply =
            json?.reply ||
            json?.output ||
            json?.text ||
            json?.message ||
            json?.response ||
            json?.reply_ar ||
            json?.reply_en ||
            (typeof json === 'string' ? json : '');

          if (rawReply && typeof rawReply === 'string' && rawReply.trim() !== '') {
            const replyText = rawReply.trim();
            const trace: AssistantRoutingTrace = {
              route: 'general_agent',
              reason: intent.intentReason,
              supabaseQueried: false,
              n8nCalled: true,
              n8nCallCount,
              matchedProductSlugs: [],
              matchConfidence: 'none'
            };

            return {
              reply_ar: json.reply_ar || replyText,
              reply_en: json.reply_en || replyText,
              recommendations: [],
              suggested_actions: [
                {
                  type: 'request_custom_system',
                  label_ar: 'طلب نظام أتمتة مخصص',
                  label_en: 'Request Custom Automation System'
                }
              ],
              source_mode: 'n8n_agent',
              route: 'general_agent',
              routing_trace: trace
            };
          }
        }
      } catch {
        // Graceful fallback if external n8n webhook is unreachable or times out
      }
    }

    const fallbackTrace: AssistantRoutingTrace = {
      route: 'general_agent',
      reason: `${intent.intentReason} (local conversational fallback after webhook unreachable)`,
      supabaseQueried: false,
      n8nCalled: n8nCallCount > 0,
      n8nCallCount,
      matchedProductSlugs: [],
      matchConfidence: 'none'
    };

    return {
      reply_ar:
        'أهلاً بك في ENGINITY! أنا مساعدك الذكي للأتمتة وحلول الذكاء الاصطناعي. يمكنني الإجابة عن استفساراتك العامة، أو ترشيح أنسب Workflow جاهز من متجرنا (مثل أتمتة ماسنجر وواتساب)، أو مساعدتك في طلب نظام أتمتة مخصص لشركتك. كيف يمكنني مساعدتك اليوم؟',
      reply_en:
        'Welcome to ENGINITY! I am your AI & Automation assistant. I can answer your general automation questions, recommend ready-made workflows from our catalog (such as Messenger and WhatsApp AI bots), or help you request a custom system. How can I help you today?',
      recommendations: [],
      suggested_actions: [
        {
          type: 'request_custom_system',
          label_ar: 'طلب نظام أتمتة مخصص',
          label_en: 'Request Custom Automation System'
        }
      ],
      source_mode: 'n8n_agent',
      route: 'general_agent',
      routing_trace: fallbackTrace
    };
  }

  // Step 4: Routes A, C, D (`catalog`, `clarification`, `no_match`) -> Local Catalog-First Engine
  // Never calls n8n when resolving product discovery, clarification, or no-match!
  let catalog: Product[] = [];
  try {
    if (params.catalogOverride) {
      catalog = params.catalogOverride.filter(
        p => p.status === 'published' || p.status === 'coming_soon'
      );
    } else if (params.fetchCatalogFn) {
      const fetched = await params.fetchCatalogFn(userMessage);
      catalog = (fetched || []).filter(
        p => p.status === 'published' || p.status === 'coming_soon'
      );
    } else {
      catalog = await searchLiveCatalog(userMessage, { throwOnError: true });
    }
  } catch (err: any) {
    return buildCatalogErrorResponse(
      userMessage,
      err?.message || 'Supabase catalog query failed'
    );
  }

  return runCatalogIntelligenceEngine(userMessage, catalog, lang);
}
