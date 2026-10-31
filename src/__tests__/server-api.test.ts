import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import type { Server } from 'http';
import { app, resetRateLimitsForTesting } from '../../server';
import { getSystemAdminToken } from '../lib/supabase';

describe('Express API Security, Orders & Webhook Verification (TASK-002, TASK-003, TASK-005, TASK-008)', () => {
  let server: Server;
  let baseUrl = '';
  let adminToken: string | null = null;

  beforeAll(async () => {
    process.env.XPAY_WEBHOOK_SECRET = 'test_xpay_secret_key_for_hmac';
    adminToken = await getSystemAdminToken();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
  });

  it('GET /api/health returns 200 JSON health status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('POST /api/admin/upload-image rejects unauthenticated requests with 401 and invalid tokens with 401', async () => {
    const resNoAuth = await fetch(`${baseUrl}/api/admin/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: 'dGVzdA==' }),
    });
    expect(resNoAuth.status).toBe(401);

    const resBadAuth = await fetch(`${baseUrl}/api/admin/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.jwt.token',
      },
      body: JSON.stringify({ imageBase64: 'dGVzdA==' }),
    });
    expect(resBadAuth.status).toBe(401);
  });

  it('POST /api/admin/upload-image enforces MIME, extension, magic-byte signature, and 5MB size limits for authenticated admins', async () => {
    if (!adminToken) return;

    // 1. Disallowed extension (.svg)
    const extRes = await fetch(`${baseUrl}/api/admin/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'exploit.svg',
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      }),
    });
    expect(extRes.status).toBe(400);

    // 2. Disallowed MIME type (image/svg+xml)
    const mimeRes = await fetch(`${baseUrl}/api/admin/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'vector.png',
        imageBase64: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      }),
    });
    expect(mimeRes.status).toBe(400);

    // 3. Disguised non-image payload (HTML/script disguised as image/png)
    const fakePngB64 = Buffer.from('<script>alert(1)</script>', 'utf8').toString('base64');
    const magicRes = await fetch(`${baseUrl}/api/admin/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'disguised.png',
        imageBase64: `data:image/png;base64,${fakePngB64}`,
      }),
    });
    expect(magicRes.status).toBe(400);
    const magicBody = await magicRes.json();
    expect(magicBody.error).toContain('binary file header');

    // 4. Oversized (>5MB) image payload
    const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 1024, 0);
    bigBuf[0] = 0x89;
    bigBuf[1] = 0x50;
    bigBuf[2] = 0x4e;
    bigBuf[3] = 0x47;
    const sizeRes = await fetch(`${baseUrl}/api/admin/upload-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'huge.png',
        imageBase64: `data:image/png;base64,${bigBuf.toString('base64')}`,
      }),
    });
    expect(sizeRes.status).toBe(413);
  });

  it('POST /api/orders rejects invalid payloads with 400 and non-existent products with 404', async () => {
    resetRateLimitsForTesting();
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: '',
        customer_name: 'A',
        customer_email: 'not-an-email',
        customer_phone: '123',
      }),
    });
    expect(res.status).toBe(400);

    const notFoundRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: '00000000-0000-0000-0000-000000000000',
        customer_name: 'Ahmed Ali',
        customer_email: 'ahmed@example.com',
        customer_phone: '201012345678',
      }),
    });
    expect(notFoundRes.status).toBe(404);
  });

  it('POST /api/webhook/xpay rejects missing or invalid HMAC signatures with 401 and non-EGP currency with 400', async () => {
    const payload = JSON.stringify({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'SUCCESSFUL',
      amount_egp: 500,
      currency: 'EGP',
    });

    const resMissing = await fetch(`${baseUrl}/api/webhook/xpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });
    expect(resMissing.status).toBe(401);

    const badSig = crypto
      .createHmac('sha256', 'wrong_secret')
      .update(payload, 'utf8')
      .digest('hex');

    const resInvalid = await fetch(`${baseUrl}/api/webhook/xpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xpay-signature': badSig,
      },
      body: payload,
    });
    expect(resInvalid.status).toBe(401);

    const usdPayload = JSON.stringify({
      order_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PAID',
      amount_egp: 500,
      currency: 'USD',
    });
    const usdSig = crypto
      .createHmac('sha256', 'test_xpay_secret_key_for_hmac')
      .update(usdPayload, 'utf8')
      .digest('hex');

    const resUsd = await fetch(`${baseUrl}/api/webhook/xpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xpay-signature': usdSig,
      },
      body: usdPayload,
    });
    expect(resUsd.status).toBe(400);
  });

  it('POST /api/assistant/chat enforces 500-character limit and 15 req / 5 min rate limit without X-Forwarded-For spoofing bypass', async () => {
    resetRateLimitsForTesting();
    const overlongMessage = 'a'.repeat(505);
    const res = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: overlongMessage,
        language: 'ar',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('500');

    // Rate limit test: send 15 invalid/empty requests from the same real IP with spoofed leftmost X-Forwarded-For
    resetRateLimitsForTesting();
    for (let i = 0; i < 15; i++) {
      const r = await fetch(`${baseUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.0.0.${i}, 198.51.100.77`,
        },
        body: JSON.stringify({ message: '' }),
      });
      expect(r.status).toBe(400);
    }

    // 16th request from the same proxy hop (198.51.100.77) must be rate-limited (429) despite spoofed first IP
    const rateLimitedRes = await fetch(`${baseUrl}/api/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '10.0.0.250, 198.51.100.77',
      },
      body: JSON.stringify({ message: 'مرحبا' }),
    });
    expect(rateLimitedRes.status).toBe(429);
  });

  it('Rejects oversized (>100kb) JSON payloads on public endpoints with 413', async () => {
    const oversizedText = 'x'.repeat(120 * 1024);
    const res = await fetch(`${baseUrl}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: 'f8cc941a-1cdc-4795-baed-d4f6972f4b87',
        email: 'user@example.com',
        interest_note: oversizedText,
      }),
    });
    expect(res.status).toBe(413);
  });

  it('POST /api/orders creates a verified order using canonical server-side pricing and ignores client price tampering, then processes raw-body signed XPay webhooks idempotently (including concurrent replays)', async () => {
    resetRateLimitsForTesting();
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: 'f8cc941a-1cdc-4795-baed-d4f6972f4b87',
        customer_name: 'Ahmed Test',
        customer_email: 'ahmed.test@example.com',
        customer_phone: '201012345678',
        amount_egp: 1, // tampered price sent by client; server must enforce canonical 500 EGP
        price_egp: 1,
        sale_price_egp: 1,
        discount_percentage: 99,
      }),
    });
    expect(orderRes.status).toBe(200);
    const orderBody = await orderRes.json();
    expect(orderBody.order_id).toBeTruthy();
    expect(orderBody.amount_egp).toBe(500);
    expect(orderBody.currency).toBe('EGP');
    expect(orderBody.redirect_url).toContain('https://checkout.xpay.app/');
    expect(orderBody.redirect_url).toContain(`order_id=${orderBody.order_id}`);

    // 1. Webhook with mismatched amount must be rejected with 400
    const mismatchPayload = JSON.stringify({
      order_id: orderBody.order_id,
      transaction_id: 'tx_mismatch_001',
      status: 'PAID',
      amount_egp: 100,
      currency: 'EGP',
    });
    const mismatchSig = crypto
      .createHmac('sha256', 'test_xpay_secret_key_for_hmac')
      .update(mismatchPayload, 'utf8')
      .digest('hex');

    const mismatchRes = await fetch(`${baseUrl}/api/webhook/xpay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-xpay-signature': mismatchSig,
      },
      body: mismatchPayload,
    });
    expect(mismatchRes.status).toBe(400);

    // 2. Valid webhook with custom whitespace in raw JSON body + concurrent replay test
    const rawFormattedPayload = `{\n  "order_id": "${orderBody.order_id}",\n  "transaction_id": "tx_valid_${Date.now()}",\n  "status": "PAID",\n  "amount_egp": 500,\n  "currency": "EGP"\n}`;
    const validSig = crypto
      .createHmac('sha256', 'test_xpay_secret_key_for_hmac')
      .update(rawFormattedPayload, 'utf8')
      .digest('hex');

    const [resA, resB] = await Promise.all([
      fetch(`${baseUrl}/api/webhook/xpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xpay-signature': validSig,
        },
        body: rawFormattedPayload,
      }),
      fetch(`${baseUrl}/api/webhook/xpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xpay-signature': validSig,
        },
        body: rawFormattedPayload,
      }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const bodyA = await resA.json();
    const bodyB = await resB.json();

    // Exactly one should be primary success (idempotent: false) and the other idempotent: true
    const idempotentFlags = [bodyA.idempotent, bodyB.idempotent].sort();
    expect(idempotentFlags).toEqual([false, true]);
  });

  it('Unmatched /api/* routes return JSON 404 instead of SPA HTML', async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-endpoint`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not found');
  });
});
