import { GoogleGenAI, Type } from '@google/genai';
import {
  AssistantProductRecommendation,
  AssistantResponsePayload,
  Lang,
  Product
} from '../types';
import { fetchProducts } from './data-store';

const SITE_BASE_URL = (
  (typeof process !== 'undefined' && (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL)) ||
  'https://enginity-store-s8dx.vercel.app'
)
  .replace(/\/+$/, '')
  .replace(/\/(ar|en)$/, '');

/**
 * 1. Read-only Catalog Retrieval Tool (T030)
 * Fetches only public-facing ('published' and 'coming_soon') products from Supabase.
 * Never exposes admin_notes, internal customer emails, or draft/archived products.
 */
export async function searchLiveCatalog(query?: string): Promise<Product[]> {
  const allPublicProducts = await fetchProducts({ publishedOnly: true });
  if (!query || !query.trim()) {
    return allPublicProducts;
  }

  const q = query.toLowerCase().trim();
  const tokens = q.split(/\s+/).filter(t => t.length >= 2);

  const scored = allPublicProducts.map(product => {
    const haystack = [
      product.name_ar,
      product.name_en,
      product.short_ar || '',
      product.short_en || '',
      product.description_ar || '',
      product.description_en || '',
      ...(product.tools || []),
      ...(product.includes_ar || []),
      ...(product.includes_en || [])
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    if (haystack.includes(q)) score += 10;
    for (const token of tokens) {
      if (haystack.includes(token)) score += 3;
    }

    // Synonym / domain matching for common Arabic & English terms
    if (
      (q.includes('واتس') || q.includes('whatsapp') || q.includes('evolution')) &&
      (haystack.includes('whatsapp') || haystack.includes('واتساب'))
    ) {
      score += 8;
    }
    if (
      (q.includes('ماسنجر') || q.includes('فيسبوك') || q.includes('messenger') || q.includes('facebook') || q.includes('meta')) &&
      (haystack.includes('messenger') || haystack.includes('ماسنجر'))
    ) {
      score += 8;
    }
    if (
      (q.includes('عياد') || q.includes('حجز') || q.includes('مواعيد') || q.includes('clinic') || q.includes('booking') || q.includes('appointment') || q.includes('تقويم') || q.includes('calendar')) &&
      (haystack.includes('calendar') || haystack.includes('مواعيد') || haystack.includes('حجز'))
    ) {
      score += 6;
    }
    if (
      (q.includes('خدمة عملاء') || q.includes('رد تلقائي') || q.includes('بوت') || q.includes('شات') || q.includes('support') || q.includes('chatbot') || q.includes('ai') || q.includes('ذكاء')) &&
      (haystack.includes('ai') || haystack.includes('ذكاء') || haystack.includes('بوت'))
    ) {
      score += 4;
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

  const defaultReasonAr =
    status === 'published'
      ? `متاح للشراء والتحميل الفوري عبر المتجر بسعر ${product.price_egp} ج.م، ويعمل باستخدام ${(product.tools || []).join('، ')}.`
      : `قيد الإطلاق قريباً (Coming Soon) بسعر متوقع ${product.price_egp} ج.م — يمكنك الانضمام لقائمة الانتظار ليصلك تنبيه فور إطلاقه.`;

  const defaultReasonEn =
    status === 'published'
      ? `Available for instant purchase & download at ${product.price_egp} EGP, powered by ${(product.tools || []).join(', ')}.`
      : `Coming Soon (expected price ${product.price_egp} EGP) — you can join the waitlist to get notified the moment it launches.`;

  const reqNamesAr = (product.requirements_ar || []).map(r => r.name).filter(Boolean);
  const reqNamesEn = (product.requirements_en || []).map(r => r.name).filter(Boolean);

  const defaultLimitAr =
    reqNamesAr.length > 0
      ? `المتطلبات الأساسية للتشغيل: ${reqNamesAr.join(' + ')}.`
      : `يتطلب بيئة عمل n8n وإعداد مفاتيح الربط الخاصة بك.`;

  const defaultLimitEn =
    reqNamesEn.length > 0
      ? `Prerequisites: ${reqNamesEn.join(' + ')}.`
      : `Requires an active n8n instance and your own API credentials.`;

  return {
    product_id: product.id,
    slug: product.slug,
    name_ar: product.name_ar,
    name_en: product.name_en,
    short_ar: product.short_ar || product.name_ar,
    short_en: product.short_en || product.name_en,
    price_egp: Number(product.price_egp) || 0,
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
  /\b(?:\d[ -]*?){13,16}\b/ // Credit card pattern
];

export function checkSecurityGuardrails(message: string): AssistantResponsePayload | null {
  for (const pattern of INJECTION_OR_SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
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
        source_mode: 'catalog_intelligence'
      };
    }
  }
  return null;
}

/**
 * 4. Built-in Bilingual Catalog Intelligence Engine (Fallback & Deterministic Grounding)
 * Understands Arabic & English intents, checks live catalog availability, asks clarifying questions
 * when input is ambiguous, and recommends verified products or custom request / suggestion flows.
 */
export function runCatalogIntelligenceEngine(
  userMessage: string,
  catalog: Product[],
  _lang: Lang = 'ar'
): AssistantResponsePayload {
  const msg = userMessage.trim();
  const lower = msg.toLowerCase();

  const publicCatalog = catalog.filter(
    p => p.status === 'published' || p.status === 'coming_soon'
  );

  // Detect if user query is very short or ambiguous greeting / general inquiry without specific platform/goal
  const hasSpecificPlatformOrDomain =
    /(واتس|whatsapp|ماسنجر|فيس|messenger|facebook|meta|عياد|حجز|مواعيد|clinic|booking|calendar|shopify|شوبيفاي|woocommerce|سلة|زد|odoo|أودو|erp|slack|تليجرام|telegram|عقارات|real estate|فواتير|accounting|sheets|شيت)/i.test(
      lower
    );

  const isGreetingOrAmbiguous =
    !hasSpecificPlatformOrDomain &&
    (msg.length < 30 ||
      /(مرحبا|اهلا|أهلا|السلام عليكم|هاي|هلا|ساعدني|محتاج مساعدة|عايز بوت|عايز اتمتة|عايز أتمتة|أريد أتمتة|hello|hi|hey|help|need automation|need a bot)/i.test(
        msg
      ));

  if (isGreetingOrAmbiguous) {
    const topRecs = publicCatalog
      .slice(0, 2)
      .map(p => buildVerifiedRecommendation(p));

    return {
      reply_ar:
        'أهلاً بك في مساعد ENGINITY الذكي! يمكنني ترشيح أنسب workflow جاهز من متجرنا أو توجيهك لطلب نظام أتمتة مخصص لشركتك. حتى أرشح لك الحل الأدق، هل يمكنك توضيح النقاط التالية؟',
      reply_en:
        'Welcome to the ENGINITY AI Shopping Assistant! I can recommend the best ready-made workflow from our live catalog or guide you to request a custom automation system. To give you the most accurate recommendation, could you clarify:',
      clarifying_questions_ar: [
        'ما هي المنصة الأساسية التي تريد أتمتتها (فيسبوك ماسنجر، واتساب، موقع إلكتروني، أو نظام داخلي)؟',
        'ما هو الهدف الرئيسي (الرد التلقائي بالذكاء الاصطناعي، حجز مواعيد، إدارة عملاء وبيانات، أم ربط أدوات متعددة)؟',
        'هل لديك بيئة n8n جاهزة حالياً أم تحتاج مساعدة في الإعداد؟'
      ],
      clarifying_questions_en: [
        'Which primary channel or platform do you want to automate (Facebook Messenger, WhatsApp, website, or internal CRM)?',
        'What is your main goal (AI customer replies, appointment booking, lead management, or multi-tool integration)?',
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
          label_en: 'Request a Custom Automation System'
        }
      ],
      source_mode: 'catalog_intelligence'
    };
  }

  // Analyze specific domain intents
  const wantsWhatsApp =
    lower.includes('واتس') ||
    lower.includes('whatsapp') ||
    lower.includes('evolution') ||
    lower.includes('رسائل صوتية');
  const wantsMessengerOrFb =
    lower.includes('ماسنجر') ||
    lower.includes('فيسبوك') ||
    lower.includes('فيس بوك') ||
    lower.includes('messenger') ||
    lower.includes('facebook') ||
    lower.includes('meta');
  const wantsBookingOrClinic =
    lower.includes('عياد') ||
    lower.includes('حجز') ||
    lower.includes('مواعيد') ||
    lower.includes('دكتور') ||
    lower.includes('طبي') ||
    lower.includes('clinic') ||
    lower.includes('booking') ||
    lower.includes('appointment') ||
    lower.includes('calendar');
  const wantsUnmatchedIntegration =
    lower.includes('shopify') ||
    lower.includes('شوبيفاي') ||
    lower.includes('woocommerce') ||
    lower.includes('ووكومرس') ||
    lower.includes('سلة') ||
    lower.includes('زد') ||
    lower.includes('odoo') ||
    lower.includes('أودو') ||
    lower.includes('erp') ||
    lower.includes('slack') ||
    lower.includes('تليجرام') ||
    lower.includes('telegram') ||
    lower.includes('عقارات') ||
    lower.includes('real estate') ||
    lower.includes('فواتير') ||
    lower.includes('accounting');

  const messengerProd = publicCatalog.find(
    p =>
      p.slug.includes('messenger') ||
      p.name_en.toLowerCase().includes('messenger') ||
      p.name_ar.includes('ماسنجر')
  );
  const whatsappProd = publicCatalog.find(
    p =>
      p.slug.includes('whatsapp') ||
      p.name_en.toLowerCase().includes('whatsapp') ||
      p.name_ar.includes('واتساب')
  );

  const recommendations: AssistantProductRecommendation[] = [];

  if (wantsMessengerOrFb && messengerProd) {
    recommendations.push(
      buildVerifiedRecommendation(
        messengerProd,
        `يتطابق مباشرة مع طلبك لأتمتة فيسبوك ماسنجر: يوفر رداً ذكياً بالذكاء الاصطناعي (Gemini) مع ذاكرة محادثة، وتحويل فوري للموظف البشري عبر تليجرام، وحجز مواعيد في Google Calendar. السعر ${messengerProd.price_egp} ج.م (${messengerProd.status === 'published' ? 'متاح للشراء الفوري' : 'قريباً'}).`,
        `Directly matches your Facebook Messenger automation need: provides Gemini AI responses with conversation memory, human takeover alerts via Telegram, and Google Calendar booking. Price: ${messengerProd.price_egp} EGP (${messengerProd.status === 'published' ? 'Available Now' : 'Coming Soon'}).`,
        'يعمل على فيسبوك ماسنجر عبر n8n وGoogle Sheets وGoogle Calendar (لا يشمل واتساب في نفس القالب).',
        'Built specifically for Facebook Messenger with n8n, Google Sheets, and Google Calendar (does not include WhatsApp out of the box).'
      )
    );
  }

  if (wantsWhatsApp && whatsappProd) {
    const isComingSoon = whatsappProd.status === 'coming_soon';
    recommendations.push(
      buildVerifiedRecommendation(
        whatsappProd,
        isComingSoon
          ? `يتطابق مع طلبك لأتمتة واتساب (يدعم النصوص والرسائل الصوتية والصور مع تحويل بشري وحجز مواعيد)، ولكنه حالياً في مرحلة "قريباً / Coming Soon" بسعر ${whatsappProd.price_egp} ج.م. يمكنك التسجيل في قائمة الانتظار ليصلك فور إطلاقه، أو طلب تنفيذه كنظام مخصص إذا كنت مستعجلاً.`
          : `يتطابق مباشرة مع طلبك لأتمتة واتساب بالذكاء الاصطناعي مع دعم الرسائل الصوتية والصور والتحويل البشري بسعر ${whatsappProd.price_egp} ج.م.`,
        isComingSoon
          ? `Matches your WhatsApp AI automation needs (supports text, voice notes, images, human takeover, and booking), currently in "Coming Soon" status at ${whatsappProd.price_egp} EGP. You can join the waitlist for launch alerts or request an urgent custom build.`
          : `Directly matches your WhatsApp AI automation needs with voice/image support and human takeover at ${whatsappProd.price_egp} EGP.`,
        'يتطلب اتصال Evolution API لربط رقم واتساب مع بيئة n8n.',
        'Requires an Evolution API connection to link your WhatsApp number with n8n.'
      )
    );
  }

  if (wantsBookingOrClinic && recommendations.length === 0) {
    if (messengerProd) {
      recommendations.push(
        buildVerifiedRecommendation(
          messengerProd,
          `يدعم حجز المواعيد التلقائي والتحقق من الأوقات المتاحة في Google Calendar وتسجيل بيانات العملاء في Google Sheets عبر فيسبوك ماسنجر (${messengerProd.price_egp} ج.م — متاح الآن).`,
          `Supports automated appointment scheduling and availability checks in Google Calendar with Google Sheets logging via Facebook Messenger (${messengerProd.price_egp} EGP — Available Now).`
        )
      );
    }
    if (whatsappProd) {
      recommendations.push(
        buildVerifiedRecommendation(
          whatsappProd,
          `يدعم حجز المواعيد والرد الذكي عبر واتساب (${whatsappProd.price_egp} ج.م — ${whatsappProd.status === 'coming_soon' ? 'قريباً في المتجر، متاح لقائمة الانتظار' : 'متاح الآن'}).`,
          `Supports automated appointment booking and AI replies via WhatsApp (${whatsappProd.price_egp} EGP — ${whatsappProd.status === 'coming_soon' ? 'Coming Soon, waitlist open' : 'Available Now'}).`
        )
      );
    }
  }

  // Case A: User asks for an integration/system NOT in our current catalog
  if (wantsUnmatchedIntegration && recommendations.length === 0) {
    return {
      reply_ar:
        'لقد راجعت كتالوج منتجات ENGINITY الحالي، ولا يوجد حالياً قالب جاهز يغطي هذه المنصة بشكل مباشر (المنتجات الجاهزة حالياً تركز على أتمتة فيسبوك ماسنجر وواتساب بالذكاء الاصطناعي مع Google Sheets وGoogle Calendar). \n\nيمكنك اختيار أحد المسارين التاليين فوراً:\n1. **تقديم طلب نظام أتمتة مخصص**: سيقوم مهندس الأتمتة بدراسة متطلباتك وبناء الـ Workflow خصيصاً لشركتك.\n2. **اقتراح هذا المنتج للمتجر**: ليتم إضافته إلى خطة المنتجات القادمة وإبلاغك عند توفره.',
      reply_en:
        'I checked the live ENGINITY catalog, and we do not currently have a ready-made template for that exact platform (our current catalog focuses on Facebook Messenger and WhatsApp AI automation with Google Sheets and Google Calendar).\n\nYou have two immediate options:\n1. **Request a Custom Automation System**: Our engineering team will review your requirements and build a tailored workflow for your business.\n2. **Suggest a New Marketplace Product**: Submit this idea so we can prioritize it for upcoming releases and notify you.',
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
      source_mode: 'catalog_intelligence'
    };
  }

  // Case B: If no specific keyword triggered yet, run general catalog search
  if (recommendations.length === 0) {
    const matched = publicCatalog.slice(0, 2);
    for (const p of matched) {
      recommendations.push(buildVerifiedRecommendation(p));
    }
  }

  const hasComingSoon = recommendations.some(r => r.status === 'coming_soon');
  const hasPublished = recommendations.some(r => r.status === 'published');

  let replyAr = '';
  let replyEn = '';

  if (wantsWhatsApp && !wantsMessengerOrFb && whatsappProd?.status === 'coming_soon') {
    replyAr = `بناءً على طلبك لأتمتة واتساب، المنتج المطابق في كتالوجنا هو **${whatsappProd.name_ar}** بسعر **${whatsappProd.price_egp} ج.م**، وهو حالياً في حالة **"قريباً (Coming Soon)"** وليس متاحاً للشراء الفوري بعد.\n\n• يمكنك **الانضمام لقائمة الانتظار** مجاناً ليصلك إشعار فور إطلاقه.\n• وإذا كنت تريد حلاً جاهزاً يعمل اليوم على فيسبوك ماسنجر، أو ترغب في بناء نظام واتساب مخصص لشركتك فوراً، يمكنك استخدام الخيارات بالأسفل:`;
    replyEn = `Based on your request for WhatsApp automation, the matching product in our catalog is **${whatsappProd.name_en}** (${whatsappProd.price_egp} EGP), which is currently **"Coming Soon"** and not yet open for instant purchase.\n\n• You can **Join the Waitlist** to get notified immediately upon launch.\n• Or if you need an urgent custom WhatsApp deployment right away, you can submit a Custom Automation Request below:`;
  } else if (hasPublished && hasComingSoon) {
    replyAr = `وجدت لك الحلول التالية في كتالوج ENGINITY بناءً على احتياجك (تتضمن منتجاً متاحاً للتحميل الفوري ومنتجاً قريباً يمكنك الانضمام لقائمة انتظاره):`;
    replyEn = `I found the following matching solutions in the live ENGINITY catalog based on your needs (including an immediately available workflow and an upcoming product with waitlist access):`;
  } else if (hasPublished) {
    replyAr = `إليك أنسب منتج متاح حالياً في كتالوج ENGINITY يطابق احتياجك، مع توضيح السعر الفعلي ومتطلبات التشغيل:`;
    replyEn = `Here is the best matching workflow currently available in the live ENGINITY catalog, including its exact price and technical prerequisites:`;
  } else {
    replyAr = `إليك أقرب المنتجات في كتالوج ENGINITY لطلبك، كما يمكنك طلب تخصيص كامل يناسب دورة عملك:`;
    replyEn = `Here are the closest workflows in the ENGINITY catalog, or you can request a custom automation system tailored to your workflow:`;
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

  return {
    reply_ar: replyAr,
    reply_en: replyEn,
    recommendations,
    suggested_actions: actions,
    source_mode: 'catalog_intelligence'
  };
}

/**
 * 5. Main Orchestrator: processAssistantTurn (T031)
 * Priority:
 *  a) Security & Prompt-Injection Guardrails
 *  b) Live Catalog Retrieval from Supabase
 *  c) Optional n8n AI Agent Webhook (if N8N_ASSISTANT_WEBHOOK_URL is configured)
 *  d) Server-side Gemini 2.5 Flash Structured Grounded Agent (if GEMINI_API_KEY is configured)
 *  e) Deterministic Bilingual Catalog Intelligence Engine Fallback
 * Every path enforces `validateRecommendationsAgainstCatalog` so zero hallucinated products ever escape.
 */
export async function processAssistantTurn(params: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  lang?: Lang;
  catalogOverride?: Product[];
  simulateProviderOutage?: boolean;
}): Promise<AssistantResponsePayload> {
  const userMessage = (params.message || '').trim().slice(0, 1500);
  const lang: Lang = params.lang === 'en' ? 'en' : 'ar';

  if (!userMessage) {
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
      source_mode: 'catalog_intelligence'
    };
  }

  // Step 1: Security & Prompt-Injection Check
  const securityBlock = checkSecurityGuardrails(userMessage);
  if (securityBlock) {
    return securityBlock;
  }

  // Step 2: Fetch Live Public Catalog from Supabase
  const catalog = params.catalogOverride
    ? params.catalogOverride.filter(p => p.status === 'published' || p.status === 'coming_soon')
    : await searchLiveCatalog(userMessage);

  // If simulating external AI provider outage (for resilience verification) or in browser without server keys
  if (params.simulateProviderOutage) {
    return runCatalogIntelligenceEngine(userMessage, catalog, lang);
  }

  // Step 3: Optional n8n AI Agent Webhook (server-side only)
  const n8nAssistantUrl =
    typeof process !== 'undefined' ? process.env.N8N_ASSISTANT_WEBHOOK_URL : undefined;
  if (n8nAssistantUrl && n8nAssistantUrl.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6500);
      const res = await fetch(n8nAssistantUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.N8N_ASSISTANT_SECRET
            ? { Authorization: `Bearer ${process.env.N8N_ASSISTANT_SECRET}` }
            : {})
        },
        body: JSON.stringify({
          message: userMessage,
          lang,
          history: (params.history || []).slice(-6),
          catalog: catalog.map(p => ({
            id: p.id,
            slug: p.slug,
            status: p.status,
            name_ar: p.name_ar,
            name_en: p.name_en,
            short_ar: p.short_ar,
            short_en: p.short_en,
            price_egp: p.price_egp,
            tools: p.tools,
            level: p.level
          }))
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        if (json && (json.reply_ar || json.reply_en)) {
          const verifiedRecs = validateRecommendationsAgainstCatalog(
            json.recommendations || [],
            catalog
          );
          return {
            reply_ar: json.reply_ar || json.reply_en,
            reply_en: json.reply_en || json.reply_ar,
            clarifying_questions_ar: Array.isArray(json.clarifying_questions_ar)
              ? json.clarifying_questions_ar
              : undefined,
            clarifying_questions_en: Array.isArray(json.clarifying_questions_en)
              ? json.clarifying_questions_en
              : undefined,
            recommendations: verifiedRecs,
            suggested_actions:
              Array.isArray(json.suggested_actions) && json.suggested_actions.length > 0
                ? json.suggested_actions
                : runCatalogIntelligenceEngine(userMessage, catalog, lang).suggested_actions,
            source_mode: 'n8n_agent'
          };
        }
      }
    } catch (err) {
      console.warn('n8n assistant webhook unreachable, falling back to Gemini / Catalog engine:', err);
    }
  }

  // Step 4: Server-side Gemini 2.5 Flash Grounded Assistant (if GEMINI_API_KEY is available)
  const geminiKey =
    typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : undefined;
  if (
    geminiKey &&
    geminiKey.trim() !== '' &&
    geminiKey !== 'MY_GEMINI_API_KEY' &&
    typeof window === 'undefined'
  ) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const sanitizedCatalogContext = catalog.map(p => ({
        product_id: p.id,
        slug: p.slug,
        status: p.status,
        name_ar: p.name_ar,
        name_en: p.name_en,
        short_ar: p.short_ar,
        short_en: p.short_en,
        price_egp: p.price_egp,
        tools: p.tools,
        level: p.level,
        requirements_ar: (p.requirements_ar || []).map(r => r.name),
        requirements_en: (p.requirements_en || []).map(r => r.name),
        includes_ar: p.includes_ar || [],
        includes_en: p.includes_en || []
      }));

      const historyText = (params.history || [])
        .slice(-6)
        .map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.content}`)
        .join('\n');

      const systemInstruction = `You are the official ENGINITY Marketplace AI Shopping Assistant.
STRICT RULES:
1. You may ONLY recommend products that exist in the provided LIVE_CATALOG JSON.
2. NEVER invent product names, IDs, slugs, capabilities, integrations, or prices.
3. Always state clearly whether a recommended product is 'published' (available for immediate purchase) or 'coming_soon' (upcoming, customer can join the waitlist).
4. If the user's request is vague or ambiguous, ask 2-3 concise clarifying questions in Arabic and English.
5. If no catalog product matches the user's requested platform/integration (e.g., Shopify, Odoo, Slack, ERP), explicitly state that no ready-made product currently matches and guide them to submit a Custom Automation Request or Product Suggestion.
6. Provide responses in both Arabic (reply_ar) and English (reply_en).

LIVE_CATALOG:
${JSON.stringify(sanitizedCatalogContext, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}Current Customer Message (${lang}): ${userMessage}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply_ar: { type: Type.STRING },
              reply_en: { type: Type.STRING },
              clarifying_questions_ar: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              clarifying_questions_en: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    product_id: { type: Type.STRING },
                    slug: { type: Type.STRING },
                    match_reason_ar: { type: Type.STRING },
                    match_reason_en: { type: Type.STRING },
                    limitations_ar: { type: Type.STRING },
                    limitations_en: { type: Type.STRING }
                  },
                  required: ['product_id', 'slug', 'match_reason_ar', 'match_reason_en']
                }
              }
            },
            required: ['reply_ar', 'reply_en', 'recommendations']
          }
        }
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText);
        const verifiedRecs = validateRecommendationsAgainstCatalog(
          parsed.recommendations || [],
          catalog
        );
        const fallbackActions = runCatalogIntelligenceEngine(
          userMessage,
          catalog,
          lang
        ).suggested_actions;

        // Build actions aligned with verifiedRecs
        const actions: AssistantResponsePayload['suggested_actions'] = [];
        for (const rec of verifiedRecs) {
          actions.push({
            type: rec.status === 'coming_soon' ? 'join_waitlist' : 'view_product',
            label_ar:
              rec.status === 'coming_soon'
                ? `انضم لقائمة الانتظار (${rec.name_ar.split('—')[0].trim()})`
                : `عرض تفاصيل وشراء (${rec.price_egp} ج.م)`,
            label_en:
              rec.status === 'coming_soon'
                ? `Join Waitlist (${rec.name_en.split('—')[0].trim()})`
                : `View & Buy (${rec.price_egp} EGP)`,
            product_id: rec.product_id,
            product_slug: rec.slug
          });
        }
        actions.push({
          type: 'request_custom_system',
          label_ar: 'طلب نظام أتمتة مخصص',
          label_en: 'Request Custom Automation System',
          prefill_topic: userMessage
        });
        actions.push({
          type: 'suggest_product',
          label_ar: 'اقتراح منتج جديد للمتجر',
          label_en: 'Suggest a New Product',
          prefill_topic: userMessage
        });

        return {
          reply_ar: parsed.reply_ar,
          reply_en: parsed.reply_en,
          clarifying_questions_ar:
            Array.isArray(parsed.clarifying_questions_ar) &&
            parsed.clarifying_questions_ar.length > 0
              ? parsed.clarifying_questions_ar
              : undefined,
          clarifying_questions_en:
            Array.isArray(parsed.clarifying_questions_en) &&
            parsed.clarifying_questions_en.length > 0
              ? parsed.clarifying_questions_en
              : undefined,
          recommendations: verifiedRecs,
          suggested_actions: actions.length > 0 ? actions : fallbackActions,
          source_mode: 'gemini_agent'
        };
      }
    } catch {
      // Fallback cleanly to deterministic Catalog Intelligence Engine if Gemini API quota/billing is unavailable
    }
  }

  // Step 5: Deterministic Bilingual Catalog Intelligence Engine Fallback
  return runCatalogIntelligenceEngine(userMessage, catalog, lang);
}
