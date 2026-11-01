import { describe, it, expect, vi } from 'vitest';
import { processAssistantTurn } from '../lib/assistant-engine';
import { Product } from '../types';

const MOCK_CATALOG: Product[] = [
  {
    id: 'prod-fb-messenger',
    slug: 'enginity-messenger-ai-human-takeover-chatbot-for-n8n',
    status: 'published',
    category_id: 1,
    name_ar: 'بوت ماسنجر الذكي مع التحويل البشري وحجز المواعيد',
    name_en: 'ENGINITY Messenger AI + Human Takeover Chatbot for n8n',
    short_ar: 'رد تلقائي ذكي على رسائل فيسبوك ماسنجر مع حجز مواعيد في تقويم جوجل.',
    short_en: 'AI auto-reply for Facebook Messenger with Google Calendar booking.',
    description_ar: 'نظام أتمتة متكامل لصفحات فيسبوك ماسنجر يعمل على n8n ويدعم التحويل البشري.',
    description_en: 'Complete Facebook Messenger AI chatbot workflow for n8n.',
    price_egp: 500,
    original_price_egp: 1000,
    sale_price_egp: 500,
    tools: ['n8n', 'Facebook Messenger', 'Google Sheets'],
    level: 'intermediate',
    includes_ar: [],
    includes_en: [],
    requirements_ar: [],
    requirements_en: [],
    steps_ar: [],
    steps_en: [],
    faq: [],
    xpay_url: '',
    cover_path: '',
    diagram_path: '',
    video_url: '',
    sort_order: 1,
    waitlist_enabled: false
  },
  {
    id: 'prod-whatsapp',
    slug: 'enginity-whatsapp-ai-human-takeover-chatbot-for-n8n',
    status: 'coming_soon',
    category_id: 1,
    name_ar: 'بوت واتساب الذكي مع التحويل البشري لـ n8n',
    name_en: 'ENGINITY WhatsApp AI + Human Takeover Chatbot for n8n',
    short_ar: 'أتمتة رسائل واتساب بالذكاء الاصطناعي مع تحويل للموظف البشري.',
    short_en: 'WhatsApp AI automation workflow with human handoff.',
    description_ar: 'نظام أتمتة واتساب متكامل قادم قريباً.',
    description_en: 'Upcoming WhatsApp AI automation workflow.',
    price_egp: 1000,
    original_price_egp: 1000,
    sale_price_egp: null,
    tools: ['n8n', 'WhatsApp', 'Evolution API', 'Google Sheets'],
    level: 'intermediate',
    includes_ar: [],
    includes_en: [],
    requirements_ar: [],
    requirements_en: [],
    steps_ar: [],
    steps_en: [],
    faq: [],
    xpay_url: '',
    cover_path: '',
    diagram_path: '',
    video_url: '',
    sort_order: 2,
    waitlist_enabled: true
  }
];

describe('AI Shopping Assistant 3-Path Routing & Scenario Test Suite', () => {
  // Scenario 1: فيسبوك / facebook / ماسنجر -> منتجات فيسبوك، بدون Webhook
  it('Scenario 1: Platform keyword matching catalog product returns products directly without calling Webhook', async () => {
    const mockWebhookFetch = vi.fn();

    const result = await processAssistantTurn({
      message: 'عايز بوت فيسبوك ماسنجر',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    // 0 Webhook calls
    expect(mockWebhookFetch).not.toHaveBeenCalled();
    expect(result.source_mode).toBe('catalog_intelligence');
    expect(result.routing_trace?.n8nCalled).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].slug).toBe('enginity-messenger-ai-human-takeover-chatbot-for-n8n');
  });

  // Scenario 2: انستجرام / instagram -> مفيش منتج <- Webhook مع matched=instagram وفلاج found=false
  it('Scenario 2: Unmatched platform (instagram) forwards to Webhook with matched=["instagram"] and found=false', async () => {
    let capturedBody: any = null;
    const mockWebhookFetch = vi.fn().mockImplementation(async (_url, init) => {
      capturedBody = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          type: 'chat',
          reply: 'سيتم توفير أتمتة انستجرام قريباً، أو يمكنك طلب نظام مخصص.',
          show_cta: false
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await processAssistantTurn({
      message: 'هل عندكم بوت انستجرام؟',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    expect(mockWebhookFetch).toHaveBeenCalledTimes(1);
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.matched).toContain('instagram');
    expect(capturedBody.found).toBe(false);
    expect(result.recommendations).toHaveLength(0);
    expect(result.reply_ar).toBe('سيتم توفير أتمتة انستجرام قريباً، أو يمكنك طلب نظام مخصص.');
    expect(result.suggested_actions).toHaveLength(0); // show_cta is false
  });

  // Scenario 3: السلام عليكم -> Webhook <- رد عادي، بدون أزرار
  it('Scenario 3: Greeting (السلام عليكم) routes to Webhook and displays reply with no CTA buttons', async () => {
    const mockWebhookFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'chat',
          reply: 'وعليكم السلام ورحمة الله وبركاته! كيف أستطيع مساعدتك اليوم؟',
          show_cta: false
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await processAssistantTurn({
      message: 'السلام عليكم',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    expect(mockWebhookFetch).toHaveBeenCalledTimes(1);
    expect(result.reply_ar).toBe('وعليكم السلام ورحمة الله وبركاته! كيف أستطيع مساعدتك اليوم؟');
    expect(result.suggested_actions).toHaveLength(0);
  });

  // Scenario 4: من انت -> Webhook <- رد تعريفي، بدون أزرار
  it('Scenario 4: Identity question (من انت) routes to Webhook and displays store_info with no CTA buttons', async () => {
    const mockWebhookFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'store_info',
          reply: 'أنا المساعد الذكي لمتجر ENGINITY، أساعدك في اختيار وفهم حلول الأتمتة لـ n8n.',
          show_cta: false
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await processAssistantTurn({
      message: 'من انت',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    expect(mockWebhookFetch).toHaveBeenCalledTimes(1);
    expect(result.reply_ar).toBe('أنا المساعد الذكي لمتجر ENGINITY، أساعدك في اختيار وفهم حلول الأتمتة لـ n8n.');
    expect(result.suggested_actions).toHaveLength(0);
  });

  // Scenario 5: عايز سيستم لعيادة أسنان -> Webhook <- system_request + أزرار
  it('Scenario 5: Custom business request routes to Webhook and displays CTAs when show_cta is true', async () => {
    const mockWebhookFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'system_request',
          reply: 'يمكننا بناء نظام مخصص بالكامل لعيادتك لإدارة حجوزات المرضى وتذكيرات المواعيد عبر واتساب.',
          show_cta: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await processAssistantTurn({
      message: 'عايز سيستم لعيادة أسنان',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    expect(mockWebhookFetch).toHaveBeenCalledTimes(1);
    expect(result.reply_ar).toBe('يمكننا بناء نظام مخصص بالكامل لعيادتك لإدارة حجوزات المرضى وتذكيرات المواعيد عبر واتساب.');
    expect(result.suggested_actions.length).toBe(3);
    expect(result.suggested_actions.map(a => a.type)).toEqual([
      'request_custom_system',
      'suggest_product',
      'contact_human_support'
    ]);
  });

  // Scenario 6: رسالة فاضية / مسافات بس -> تتجاهل أو تطلب كتابة سؤال، بدون crash
  it('Scenario 6: Empty message or whitespace only prompts user to type a question without crash or Webhook call', async () => {
    const mockWebhookFetch = vi.fn();

    const emptyResult = await processAssistantTurn({
      message: '   ',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    expect(mockWebhookFetch).not.toHaveBeenCalled();
    expect(emptyResult.reply_ar).toContain('يرجى كتابة سؤالك');
    expect(emptyResult.recommendations).toHaveLength(0);
    expect(emptyResult.suggested_actions).toHaveLength(0);
  });

  // Scenario 7: Webhook واقع أو رد مش JSON -> fallback ودود بدون أزرار
  it('Scenario 7: Webhook outage or non-JSON error returns friendly fallback without buttons and never returns "ملقيتش منتج"', async () => {
    const mockWebhookFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await processAssistantTurn({
      message: 'سؤال غير موجود في الكتالوج',
      catalogOverride: MOCK_CATALOG,
      webhookFetchFn: mockWebhookFetch as unknown as typeof fetch,
      webhookUrlOverride: 'https://example.com/webhook'
    });

    expect(result.reply_ar).toBe('حصلت مشكلة مؤقتة، جرب تاني');
    expect(result.reply_ar).not.toContain('ملقيتش');
    expect(result.reply_ar).not.toContain('بحثت في الكتالوج ولم أجد');
    expect(result.suggested_actions).toHaveLength(0);
  });

  // Scenario 8: الـ URL مش موجود -> تطلبه مني، ماتكملش
  it('Scenario 8: If Webhook URL is completely absent, returns message requesting URL configuration', async () => {
    const result = await processAssistantTurn({
      message: 'سؤال يحتاج Webhook',
      catalogOverride: MOCK_CATALOG,
      webhookUrlOverride: '' // explicitly empty override to test missing URL
    });

    expect(result.reply_ar).toContain('مفيش منتج جاهز مطابق');
    expect(result.suggested_actions).toHaveLength(3); // automation_request type returns 3 buttons
  });
});
