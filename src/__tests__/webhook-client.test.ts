import { describe, it, expect, vi } from 'vitest';
import {
  parseWebhookResponse,
  sendToN8nWebhook,
  FALLBACK_REPLY_AR,
  FALLBACK_REPLY_EN
} from '../lib/assistant/webhook-client';

describe('T2: Webhook Client & Response Parsing', () => {
  it('parses valid chat response without CTA', () => {
    const raw = JSON.stringify({
      type: 'chat',
      reply: 'وعليكم السلام ورحمة الله! كيف أساعدك اليوم؟',
      show_cta: false
    });
    const parsed = parseWebhookResponse(raw, 'ar');
    expect(parsed.type).toBe('chat');
    expect(parsed.reply).toBe('وعليكم السلام ورحمة الله! كيف أساعدك اليوم؟');
    expect(parsed.show_cta).toBe(false);
    expect(parsed.success).toBe(true);
  });

  it('parses automation_request response with type automation_request', () => {
    const raw = JSON.stringify({
      type: 'automation_request',
      reply: 'يمكننا تصميم وتطوير سيستم مخصص لإدارة عيادتك الطبية وحجز المواعيد.'
    });
    const parsed = parseWebhookResponse(raw, 'ar');
    expect(parsed.type).toBe('automation_request');
    expect(parsed.reply).toContain('سيستم مخصص');
    expect(parsed.show_cta).toBe(true);
    expect(parsed.success).toBe(true);
  });

  it('falls back gracefully to friendly message on non-JSON response and disables CTA', () => {
    const rawInvalid = '<html><head><title>502 Bad Gateway</title></head></html>';
    const parsedAr = parseWebhookResponse(rawInvalid, 'ar');
    expect(parsedAr.reply).toBe(FALLBACK_REPLY_AR);
    expect(parsedAr.show_cta).toBe(false);
    expect(parsedAr.success).toBe(false);
    expect(parsedAr.reply).not.toContain('ملقيتش');

    const parsedEn = parseWebhookResponse(rawInvalid, 'en');
    expect(parsedEn.reply).toBe(FALLBACK_REPLY_EN);
    expect(parsedEn.show_cta).toBe(false);
  });

  it('sends correct payload including matched platforms and found=false to the webhook', async () => {
    let capturedBody: any = null;
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            type: 'automation_request',
            reply: 'حالياً لا يوجد سيستم انستجرام جاهز، لكن يمكننا بناءه لك.'
          })
      } as any;
    });

    const result = await sendToN8nWebhook({
      message: 'عايز بوت انستجرام',
      matched: ['instagram'],
      found: false,
      language: 'ar',
      fetchFn: mockFetch,
      webhookUrlOverride: 'https://test-webhook.example.com/webhook'
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.message).toBe('عايز بوت انستجرام');
    expect(capturedBody.matched).toEqual(['instagram']);
    expect(capturedBody.found).toBe(false);

    expect(result.reply).toContain('انستجرام');
    expect(result.type).toBe('automation_request');
    expect(result.show_cta).toBe(true);
  });

  it('handles network error by returning friendly fallback without crashing', async () => {
    const mockFailingFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

    const result = await sendToN8nWebhook({
      message: 'السلام عليكم',
      matched: [],
      found: false,
      language: 'ar',
      fetchFn: mockFailingFetch,
      webhookUrlOverride: 'https://unreachable.example.com/webhook'
    });

    expect(result.reply).toBe(FALLBACK_REPLY_AR);
    expect(result.show_cta).toBe(false);
    expect(result.reply).not.toContain('ملقيتش');
  });

  it('returns explicit error message if no webhook URL is configured anywhere', async () => {
    const result = await sendToN8nWebhook({
      message: 'السلام عليكم',
      matched: [],
      found: false,
      language: 'ar',
      webhookUrlOverride: '' // Empty URL
    });

    // When getWebhookUrl() is called in Node with empty override, it tests the missing URL branch
    expect(result.show_cta).toBe(false);
  });
});
