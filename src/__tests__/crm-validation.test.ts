import { describe, it, expect } from 'vitest';
import {
  waitlistSubmissionSchema,
  customRequestSubmissionSchema,
  productSuggestionSubmissionSchema,
  reviewSubmissionSchema,
  orderInitSchema,
  isHoneypotTriggered,
  checkSubmissionCooldown,
  recordSubmissionTimestamp
} from '../lib/validation';
import { computeDemandAnalytics } from '../lib/crm-store';
import { ProductSuggestion } from '../types';

describe('CRM Validation, Anti-Spam & Demand Analytics (TASK-006 & TASK-007)', () => {
  it('validates waitlist submissions and normalizes email to lowercase', () => {
    const validEmailWaitlist = waitlistSubmissionSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'Customer@Example.com',
      whatsapp_number: '+201012345678'
    });
    expect(validEmailWaitlist.success).toBe(true);
    if (validEmailWaitlist.success) {
      expect(validEmailWaitlist.data.email).toBe('customer@example.com');
    }

    const invalidEmail = waitlistSubmissionSchema.safeParse({
      product_id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'not-an-email'
    });
    expect(invalidEmail.success).toBe(false);
  });

  it('validates custom automation requests and enforces field length limits', () => {
    const validReq = customRequestSubmissionSchema.safeParse({
      full_name: 'Ahmed Mahmoud',
      brand_name: 'Namaa Clinic',
      industry: 'Medical Clinic',
      email: 'ahmed@company.com',
      whatsapp_number: '+201012345678',
      automation_goal: 'Automated AI booking synced with Google Calendar.',
      platforms_involved: ['n8n', 'WhatsApp']
    });
    expect(validReq.success).toBe(true);

    const invalidShortGoal = customRequestSubmissionSchema.safeParse({
      full_name: 'Ahmed',
      email: 'ahmed@company.com',
      whatsapp_number: '+201012345678',
      automation_goal: 'abc'
    });
    expect(invalidShortGoal.success).toBe(false);
  });

  it('validates product suggestions and reviews', () => {
    const validSuggestion = productSuggestionSubmissionSchema.safeParse({
      proposed_name: 'Shopify Abandoned Cart WhatsApp Bot',
      problem_solved: 'Recovers abandoned checkouts via automated WhatsApp messages.',
      target_audience: 'Shopify merchants in MENA',
      platforms_integrations: ['Shopify', 'WhatsApp'],
      email: 'merchant@store.com',
      purchase_likelihood: 'definitely',
      contact_consent: true
    });
    expect(validSuggestion.success).toBe(true);

    const validReview = reviewSubmissionSchema.safeParse({
      product_id: 'prod-1',
      customer_name: 'سارة محمود',
      rating: 5,
      review_text: 'نظام ممتاز وسهل التركيب على n8n'
    });
    expect(validReview.success).toBe(true);

    const invalidRating = reviewSubmissionSchema.safeParse({
      product_id: 'prod-1',
      customer_name: 'User',
      rating: 6,
      review_text: 'Invalid rating above 5'
    });
    expect(invalidRating.success).toBe(false);
  });

  it('validates order initialization payload', () => {
    const validOrder = orderInitSchema.safeParse({
      product_id: 'prod-123',
      customer_name: 'Mohamed Ali',
      customer_email: 'mohamed@example.com',
      customer_phone: '+201012345678'
    });
    expect(validOrder.success).toBe(true);
  });

  it('detects honeypot triggers and enforces 60-second cooldown', () => {
    expect(isHoneypotTriggered('')).toBe(false);
    expect(isHoneypotTriggered(undefined)).toBe(false);
    expect(isHoneypotTriggered('https://spam-bot.example')).toBe(true);
    expect(isHoneypotTriggered({ website_url: 'https://spam-bot.example' })).toBe(true);

    const key = `test_form_${Date.now()}`;
    expect(checkSubmissionCooldown(key, 60_000).allowed).toBe(true);
    recordSubmissionTimestamp(key);
    const afterSubmit = checkSubmissionCooldown(key, 60_000);
    expect(afterSubmit.allowed).toBe(false);
    expect(afterSubmit.remainingSeconds).toBeGreaterThan(0);
  });

  it('computes demand analytics clusters and deduplicates repeated contact submissions', () => {
    const suggestions: ProductSuggestion[] = [
      {
        id: '1',
        proposed_name: 'Shopify WhatsApp Order Confirmation Bot',
        problem_solved: 'Confirm COD orders via WhatsApp',
        target_audience: 'E-commerce',
        expected_features: undefined,
        platforms_integrations: ['Shopify', 'WhatsApp'],
        email: 'owner1@shop.com',
        whatsapp_number: undefined,
        purchase_likelihood: 'very_likely',
        preferred_price_range: '500 EGP',
        additional_context: undefined,
        contact_consent: true,
        status: 'under_review',
        admin_notes: undefined,
        converted_product_id: null,
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z'
      },
      {
        id: '2',
        proposed_name: 'Shopify WhatsApp Order Confirmation Bot',
        problem_solved: 'Confirm COD orders via WhatsApp',
        target_audience: 'E-commerce',
        expected_features: undefined,
        platforms_integrations: ['Shopify', 'WhatsApp'],
        email: 'owner2@shop.com',
        whatsapp_number: undefined,
        purchase_likelihood: 'likely',
        preferred_price_range: '500 EGP',
        additional_context: undefined,
        contact_consent: true,
        status: 'under_review',
        admin_notes: undefined,
        converted_product_id: null,
        created_at: '2026-03-02T10:00:00Z',
        updated_at: '2026-03-02T10:00:00Z'
      }
    ];

    const analytics = computeDemandAnalytics(suggestions);
    expect(analytics.total_submissions).toBe(2);
    expect(analytics.distinct_contacts).toBe(2);
    expect(
      analytics.intent_distribution.very_likely + analytics.intent_distribution.likely
    ).toBe(2);
    expect(analytics.top_ideas.length).toBe(1);
    expect(analytics.top_ideas[0].submissions_count).toBe(2);
    expect(analytics.top_ideas[0].distinct_contacts_count).toBe(2);
  });
});
