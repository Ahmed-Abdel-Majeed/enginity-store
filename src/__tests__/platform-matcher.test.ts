import { describe, it, expect } from 'vitest';
import {
  matchPlatformsInQuery,
  matchCatalogProducts
} from '../lib/assistant/platform-matcher';
import { Product } from '../types';

const SAMPLE_CATALOG: Product[] = [
  {
    id: 'prod-messenger',
    slug: 'enginity-messenger-ai-human-takeover-chatbot-for-n8n',
    status: 'published',
    category_id: 1,
    name_ar: 'بوت ماسنجر الذكي مع التحويل البشري',
    name_en: 'ENGINITY Messenger AI Chatbot',
    short_ar: 'رد تلقائي ذكي على رسائل فيسبوك ماسنجر',
    short_en: 'Facebook Messenger AI auto-reply',
    description_ar: 'نظام أتمتة متكامل لصفحات فيسبوك ماسنجر',
    description_en: 'Complete Facebook Messenger AI chatbot workflow',
    price_egp: 500,
    original_price_egp: 1000,
    sale_price_egp: 500,
    tools: ['n8n', 'Facebook Messenger', 'Meta for Developers', 'Google Sheets'],
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
    name_ar: 'بوت واتساب الذكي مع التحويل البشري',
    name_en: 'ENGINITY WhatsApp AI Chatbot',
    short_ar: 'أتمتة رسائل واتساب بالذكاء الاصطناعي',
    short_en: 'WhatsApp AI automation workflow',
    description_ar: 'نظام أتمتة واتساب متكامل',
    description_en: 'Upcoming WhatsApp AI automation',
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

describe('T1: Platform Keyword Matching & Synonym Resolution', () => {
  it('resolves facebook synonyms (فيسبوك, ماسنجر, facebook, messenger) to facebook platform and retrieves products', () => {
    const queries = ['عايز بوت فيسبوك', 'شات بوت ماسنجر', 'facebook bot', 'messenger automation'];
    for (const q of queries) {
      const match = matchCatalogProducts(q, SAMPLE_CATALOG);
      expect(match.matchedPlatforms).toContain('facebook');
      expect(match.found).toBe(true);
      expect(match.products.length).toBeGreaterThan(0);
      expect(match.products[0].slug).toBe('enginity-messenger-ai-human-takeover-chatbot-for-n8n');
    }
  });

  it('resolves whatsapp synonyms (واتساب, واتس, whatsapp) and retrieves WhatsApp product', () => {
    const queries = ['هل عندكم بوت واتساب؟', 'سيستم واتس بالذكاء الاصطناعي', 'whatsapp automation workflow'];
    for (const q of queries) {
      const match = matchCatalogProducts(q, SAMPLE_CATALOG);
      expect(match.matchedPlatforms).toContain('whatsapp');
      expect(match.found).toBe(true);
      expect(match.products[0].slug).toBe('enginity-whatsapp-ai-human-takeover-chatbot-for-n8n');
    }
  });

  it('recognizes instagram platform keyword but returns found=false because no catalog product exists', () => {
    const queries = ['انستجرام', 'عايز بوت انستغرام', 'instagram workflow', 'انستا'];
    for (const q of queries) {
      const match = matchCatalogProducts(q, SAMPLE_CATALOG);
      expect(match.matchedPlatforms).toContain('instagram');
      expect(match.found).toBe(false);
      expect(match.products.length).toBe(0);
    }
  });

  it('returns no matched platforms and found=false for general conversations and custom requests', () => {
    const generalQueries = [
      'السلام عليكم',
      'من انت',
      'عايز سيستم لعيادة أسنان',
      'كيف يعمل الموقع؟',
      'شكرا جزيلا'
    ];
    for (const q of generalQueries) {
      const match = matchCatalogProducts(q, SAMPLE_CATALOG);
      expect(match.matchedPlatforms.length).toBe(0);
      expect(match.found).toBe(false);
      expect(match.products.length).toBe(0);
    }
  });

  it('safely handles empty queries and whitespace without crashing', () => {
    const emptyQueries = ['', '   ', '\n\t  '];
    for (const q of emptyQueries) {
      const match = matchCatalogProducts(q, SAMPLE_CATALOG);
      expect(match.matchedPlatforms.length).toBe(0);
      expect(match.found).toBe(false);
      expect(match.products.length).toBe(0);
    }
  });
});
