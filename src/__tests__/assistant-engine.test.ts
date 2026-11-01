import { describe, it, expect } from 'vitest';
import {
  detectUserIntent,
  runCatalogIntelligenceEngine,
  buildVerifiedRecommendation
} from '../lib/assistant-engine';
import { PUBLIC_PRODUCT_COLUMNS } from '../lib/data-store';
import { Product } from '../types';

const MOCK_CATALOG: Product[] = [
  {
    id: 'prod-messenger-1',
    slug: 'enginity-messenger-ai-human-takeover-chatbot-for-n8n',
    status: 'published',
    category_id: 1,
    name_ar: 'بوت ماسنجر الذكي مع التحويل البشري وحجز المواعيد',
    name_en: 'ENGINITY Messenger AI + Human Takeover Chatbot for n8n',
    short_ar: 'رد تلقائي ذكي على رسائل فيسبوك ماسنجر مع حجز مواعيد في تقويم جوجل.',
    short_en: 'AI auto-reply for Facebook Messenger with Google Calendar booking and human takeover.',
    description_ar: 'نظام أتمتة متكامل لصفحات فيسبوك ماسنجر يعمل على n8n ويدعم التحويل البشري.',
    description_en: 'Complete Facebook Messenger AI chatbot workflow for n8n with human handoff.',
    price_egp: 500,
    original_price_egp: 1000,
    sale_price_egp: 500,
    tools: ['n8n', 'Facebook Messenger', 'Google Calendar', 'Google Sheets', 'Gemini'],
    level: 'intermediate',
    includes_ar: ['ملف n8n JSON كامل'],
    includes_en: ['Complete n8n JSON workflow'],
    requirements_ar: [{ name: 'n8n', desc: 'بيئة عمل n8n' }],
    requirements_en: [{ name: 'n8n', desc: 'Active n8n workspace' }],
    steps_ar: [],
    steps_en: [],
    faq: [],
    xpay_url: 'https://community.xpay.app/pay/test',
    cover_path: '',
    diagram_path: '',
    video_url: '',
    sort_order: 1,
    waitlist_enabled: false
  },
  {
    id: 'prod-whatsapp-2',
    slug: 'enginity-whatsapp-ai-human-takeover-chatbot-for-n8n',
    status: 'coming_soon',
    category_id: 1,
    name_ar: 'بوت واتساب الذكي مع التحويل البشري لـ n8n',
    name_en: 'ENGINITY WhatsApp AI + Human Takeover Chatbot for n8n',
    short_ar: 'أتمتة رسائل واتساب بالذكاء الاصطناعي مع تحويل للموظف البشري.',
    short_en: 'WhatsApp AI automation workflow with human handoff and Google Sheets logging.',
    description_ar: 'نظام أتمتة واتساب متكامل قادم قريباً.',
    description_en: 'Upcoming WhatsApp AI automation workflow.',
    price_egp: 1000,
    original_price_egp: 1000,
    sale_price_egp: null,
    tools: ['n8n', 'WhatsApp', 'Evolution API', 'Google Sheets'],
    level: 'intermediate',
    includes_ar: ['ملف n8n JSON'],
    includes_en: ['n8n JSON workflow'],
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

describe('AI Shopping Assistant Catalog-First Engine & Public Column Projection (TASK-001 & TASK-008)', () => {
  it('excludes file_url and admin_notes from PUBLIC_PRODUCT_COLUMNS', () => {
    const columns = PUBLIC_PRODUCT_COLUMNS.split(',').map(c => c.trim());
    expect(columns).not.toContain('file_url');
    expect(columns).not.toContain('admin_notes');
    expect(columns).toContain('slug');
    expect(columns).toContain('original_price_egp');
    expect(columns).toContain('sale_price_egp');
  });

  it('detects product discovery intents in Arabic and English and rejection feedback', () => {
    const messengerIntent = detectUserIntent('عايز بوت للماسنجر يرد على العملاء');
    expect(messengerIntent.requestedPlatforms).toContain('messenger');
    expect(messengerIntent.isGeneralAgentConversation).toBe(false);

    const whatsappIntent = detectUserIntent('Do you have a WhatsApp automation workflow?');
    expect(whatsappIntent.requestedPlatforms).toContain('whatsapp');
    expect(whatsappIntent.isGeneralAgentConversation).toBe(false);

    const rejectionIntent = detectUserIntent('ولا نظام من دول مناسب لاحتياجي');
    expect(rejectionIntent.isExplicitNoMatchFeedback).toBe(true);
  });

  it('recommends the published Messenger product with accurate discount pricing without calling external webhook', () => {
    const result = runCatalogIntelligenceEngine(
      'أريد بوت للرد التلقائي على رسائل فيسبوك ماسنجر وحجز مواعيد',
      MOCK_CATALOG,
      'ar'
    );

    expect(result.route).toBe('catalog');
    expect(result.routing_trace?.n8nCalled).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].slug).toBe(
      'enginity-messenger-ai-human-takeover-chatbot-for-n8n'
    );
    expect(result.recommendations[0].price_egp).toBe(500);
    expect(result.recommendations[0].original_price_egp).toBe(1000);
    expect(result.recommendations[0].discount_percentage).toBe(50);
  });

  it('identifies coming_soon status for WhatsApp queries accurately', () => {
    const result = runCatalogIntelligenceEngine(
      'عايز أتمتة واتساب بالذكاء الاصطناعي',
      MOCK_CATALOG,
      'ar'
    );
    expect(result.route).toBe('catalog');
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].slug).toBe(
      'enginity-whatsapp-ai-human-takeover-chatbot-for-n8n'
    );
    expect(result.recommendations[0].status).toBe('coming_soon');

    const verifiedCard = buildVerifiedRecommendation(MOCK_CATALOG[1]);
    expect(verifiedCard.status).toBe('coming_soon');
    expect(verifiedCard.price_egp).toBe(1000);
  });
});
