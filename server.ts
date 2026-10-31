import dotenv from 'dotenv';
const runtimePort = process.env.PORT;
dotenv.config({ override: true });
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEffectiveProductPricing } from './src/lib/utils';
import {
  orderInitSchema,
  waitlistSubmissionSchema,
  customRequestSubmissionSchema,
  productSuggestionSubmissionSchema,
  reviewSubmissionSchema,
  isHoneypotTriggered,
} from './src/lib/validation';

export const app = express();
const PORT = Number(runtimePort) || 3000;

const rawBodyCapture = (req: Request, _res: Response, buf: Buffer) => {
  if (buf && buf.length > 0) {
    (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  }
};

// Allow up to 10MB only on the authenticated admin image upload route; enforce 100kb on all other routes
app.use('/api/admin/upload-image', express.json({ limit: '10mb', verify: rawBodyCapture }));
app.use(express.json({ limit: '100kb', verify: rawBodyCapture }));

app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }
  next(err);
});

// ==========================================
// Environment & Supabase Helpers
// ==========================================
let verifiedServiceKeyStatus: { key: string; valid: boolean } | null = null;
let cachedAdminSession: { token: string; expiresAt: number } | null = null;

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const supabaseAnonKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  const rawServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseServiceKey =
    rawServiceKey.startsWith('eyJ') &&
    rawServiceKey.length > 100 &&
    rawServiceKey.length < 300 &&
    rawServiceKey !== supabaseAnonKey
      ? rawServiceKey
      : '';
  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
}

function getAnonSupabaseClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getRequestSupabaseClient(req: Request): SupabaseClient | null {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const authHeader = req.headers.authorization;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAdminWriteSupabaseClient(req?: Request): Promise<SupabaseClient | null> {
  const { supabaseUrl, supabaseAnonKey, supabaseServiceKey } = getSupabaseConfig();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  if (supabaseServiceKey) {
    if (!verifiedServiceKeyStatus || verifiedServiceKeyStatus.key !== supabaseServiceKey) {
      const candidate = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await candidate.from('settings').select('id').limit(1);
      verifiedServiceKeyStatus = { key: supabaseServiceKey, valid: !error };
      if (!error) return candidate;
    } else if (verifiedServiceKeyStatus.valid) {
      return createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  if (req?.headers.authorization) {
    return getRequestSupabaseClient(req);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const now = Date.now();
    if (cachedAdminSession && cachedAdminSession.expiresAt > now + 30_000) {
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${cachedAdminSession.token}` },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    const temp = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await temp.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (!error && data?.session?.access_token) {
      cachedAdminSession = {
        token: data.session.access_token,
        expiresAt: data.session.expires_at
          ? data.session.expires_at * 1000
          : now + 50 * 60 * 1000,
      };
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
  }

  return getAnonSupabaseClient();
}

// ==========================================
// Rate Limiters
// ==========================================
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const recentWaitlistServerMap = new Map<string, number>();
const recentCustomReqServerMap = new Map<string, number>();
const recentSuggestionServerMap = new Map<string, number>();

export function resetRateLimitsForTesting(): void {
  rateLimitMap.clear();
  recentWaitlistServerMap.clear();
  recentCustomReqServerMap.clear();
  recentSuggestionServerMap.clear();
}

function checkRateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetTime) rateLimitMap.delete(k);
    }
  }
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count += 1;
  return true;
}

function getClientIp(req: Request): string {
  const vercelForwarded = req.headers['x-vercel-forwarded-for'];
  if (typeof vercelForwarded === 'string' && vercelForwarded.trim()) {
    return vercelForwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    return parts[parts.length - 1] || parts[0] || 'unknown';
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ==========================================
// Admin Authorization Middleware (TASK-005)
// ==========================================
export async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty Bearer token' });
    return;
  }

  const client = getRequestSupabaseClient(req);
  if (!client) {
    res.status(503).json({ error: 'Supabase is not configured on the server' });
    return;
  }

  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(token);

    if (userError || !user) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
      return;
    }

    const { data: isAdmin, error: rpcError } = await client.rpc('is_admin');
    if (rpcError || !isAdmin) {
      res.status(403).json({ error: 'Forbidden: User is not an authorized administrator' });
      return;
    }

    (req as Request & { adminUser?: { id: string; email?: string } }).adminUser = {
      id: user.id,
      email: user.email,
    };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Failed to verify administrator session' });
  }
}

// ==========================================
// 1. Health Check Endpoint (TASK-002)
// ==========================================
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// 2. Order Checkout & XPay Webhook (TASK-003, TASK-V02)
// ==========================================
interface InMemoryOrderRecord {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount_egp: number;
  currency: 'EGP';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  xpay_transaction_id: string | null;
  fulfilled_at: string | null;
  created_at: string;
  product_snapshot?: {
    slug: string;
    name_ar: string;
    name_en: string;
    file_url?: string;
  };
}

export const inMemoryOrders = new Map<string, InMemoryOrderRecord>();
const processedTransactions = new Set<string>();
const inFlightWebhookOrders = new Set<string>();

export function resetOrdersForTesting(): void {
  inMemoryOrders.clear();
  processedTransactions.clear();
  inFlightWebhookOrders.clear();
}

function isAllowedXPayUrl(urlString: string): boolean {
  try {
    const parsedUrl = new URL(urlString);
    if (parsedUrl.protocol !== 'https:') return false;
    const allowedHosts = (
      process.env.XPAY_ALLOWED_HOSTS ||
      'checkout.xpay.app,community.xpay.app,xpay.app,staging.xpay.app'
    )
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    return allowedHosts.includes(parsedUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function handleCreateOrder(req: Request, res: Response): Promise<void> {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(`orders:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many checkout requests. Please try again in a minute.' });
      return;
    }

    if (isHoneypotTriggered(req.body || {})) {
      res.status(400).json({ error: 'Invalid checkout request.' });
      return;
    }

    const parsed = orderInitSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid checkout fields',
        issues: parsed.error.issues,
      });
      return;
    }

    const { product_id, customer_name, customer_email, customer_phone } = parsed.data;

    const sb = await getAdminWriteSupabaseClient();
    let product: any = null;

    if (sb) {
      const { data, error } = await sb
        .from('products')
        .select(
          'id, slug, status, name_ar, name_en, price_egp, original_price_egp, sale_price_egp, xpay_url'
        )
        .eq('id', product_id)
        .maybeSingle();

      if (!error && data) {
        product = data;
      }
    }

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.status !== 'published') {
      res.status(400).json({
        error:
          product.status === 'coming_soon'
            ? 'This product is coming soon and cannot be purchased yet.'
            : 'This product is not available for purchase.',
      });
      return;
    }

    // Server-side canonical price calculation (never trusts client price)
    const pricing = getEffectiveProductPricing(product);
    const canonicalAmountEgp = pricing.effectivePriceEgp;

    if (!Number.isFinite(canonicalAmountEgp) || canonicalAmountEgp <= 0) {
      res.status(400).json({ error: 'Invalid product catalog price configuration.' });
      return;
    }

    if (!product.xpay_url || !isAllowedXPayUrl(product.xpay_url)) {
      res.status(400).json({ error: 'Invalid or untrusted payment gateway URL.' });
      return;
    }

    // Look up protected deliverable file_url if available (for fulfillment snapshot)
    let deliverableUrl = '';
    if (sb) {
      const { data: deliv } = await sb
        .from('product_deliverables')
        .select('file_url')
        .eq('product_id', product.id)
        .maybeSingle();
      if (deliv?.file_url) {
        deliverableUrl = deliv.file_url;
      }
    }

    let orderId: string = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    if (sb) {
      const { data: insertedOrder, error: orderError } = await sb
        .from('orders')
        .insert({
          product_id: product.id,
          customer_name,
          customer_email,
          customer_phone,
          amount_egp: canonicalAmountEgp,
          status: 'pending',
        })
        .select('id')
        .maybeSingle();

      if (!orderError && insertedOrder?.id) {
        orderId = insertedOrder.id;
      }
    }

    // Always store in-memory state as well for fast webhook verification & fallback
    inMemoryOrders.set(orderId, {
      id: orderId,
      product_id: product.id,
      customer_name,
      customer_email,
      customer_phone,
      amount_egp: canonicalAmountEgp,
      currency: 'EGP',
      status: 'pending',
      xpay_transaction_id: null,
      fulfilled_at: null,
      created_at: nowIso,
      product_snapshot: {
        slug: product.slug,
        name_ar: product.name_ar,
        name_en: product.name_en,
        file_url: deliverableUrl,
      },
    });

    const checkoutUrl = new URL(product.xpay_url);
    checkoutUrl.searchParams.set('order_id', orderId);
    checkoutUrl.searchParams.set('customer_email', customer_email);
    checkoutUrl.searchParams.set('customer_name', customer_name);
    checkoutUrl.searchParams.set('customer_phone', customer_phone);
    checkoutUrl.searchParams.set('amount_egp', String(canonicalAmountEgp));

    res.status(200).json({
      order_id: orderId,
      amount_egp: canonicalAmountEgp,
      currency: 'EGP',
      redirect_url: checkoutUrl.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error while creating order' });
  }
}

app.post('/api/orders', handleCreateOrder);
app.post('/api/checkout/init', handleCreateOrder);

function verifyWebhookSignature(rawPayload: string, providedSignature: string, secret: string): boolean {
  if (!providedSignature || !secret) return false;
  const trimmed = providedSignature.trim();

  // Support either direct shared secret match or HMAC-SHA256 hex digest
  const hmacDigest = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

  const safeCompare = (a: string, b: string) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  return safeCompare(trimmed, secret) || safeCompare(trimmed, hmacDigest);
}

app.post('/api/webhook/xpay', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.XPAY_WEBHOOK_SECRET || '';
    const providedSignature =
      (req.headers['x-xpay-signature'] as string) ||
      (req.headers['x-webhook-secret'] as string) ||
      '';

    if (!webhookSecret) {
      res.status(503).json({ error: 'Webhook verification secret is not configured' });
      return;
    }

    const rawBody =
      (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    if (!verifyWebhookSignature(rawBody, providedSignature, webhookSecret)) {
      res.status(401).json({ error: 'Unauthorized: Invalid webhook signature' });
      return;
    }

    const {
      order_id,
      transaction_id,
      status,
      amount_egp,
      total_amount,
      currency = 'EGP',
    } = req.body || {};

    if (!order_id || !status) {
      res.status(400).json({ error: 'Missing required fields: order_id and status' });
      return;
    }

    const orderKey = String(order_id).trim();
    const normalizedStatus = String(status).toUpperCase().trim();
    if (!['PAID', 'SUCCESS', 'SUCCESSFUL'].includes(normalizedStatus)) {
      res.status(200).json({ status: 'ignored', reason: `Unhandled payment status: ${status}` });
      return;
    }

    if (String(currency).toUpperCase().trim() !== 'EGP') {
      res.status(400).json({ error: 'Invalid settlement currency; expected EGP' });
      return;
    }

    const txId = transaction_id ? String(transaction_id).trim() : '';
    if (txId && processedTransactions.has(txId)) {
      res.status(200).json({ status: 'already_processed', idempotent: true });
      return;
    }

    if (inFlightWebhookOrders.has(orderKey)) {
      res.status(200).json({ status: 'already_processed', idempotent: true });
      return;
    }

    inFlightWebhookOrders.add(orderKey);
    try {
      const sb = await getAdminWriteSupabaseClient();
      let orderRecord: InMemoryOrderRecord | null = inMemoryOrders.get(orderKey) || null;
      let dbProduct: any = null;

      if (sb) {
        const { data: dbOrder } = await sb
          .from('orders')
          .select(
            '*, products(id, slug, name_ar, name_en, price_egp, original_price_egp, sale_price_egp)'
          )
          .eq('id', orderKey)
          .maybeSingle();

        if (dbOrder) {
          dbProduct = (dbOrder as any).products || null;
          orderRecord = {
            id: dbOrder.id,
            product_id: dbOrder.product_id,
            customer_name: dbOrder.customer_name,
            customer_email: dbOrder.customer_email,
            customer_phone: dbOrder.customer_phone,
            amount_egp: Number(dbOrder.amount_egp),
            currency: 'EGP',
            status: dbOrder.status,
            xpay_transaction_id: dbOrder.xpay_transaction_id || null,
            fulfilled_at: dbOrder.fulfilled_at || null,
            created_at: dbOrder.created_at,
          };
        }
      }

      if (!orderRecord) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Idempotency guard: already paid/fulfilled
      if (
        orderRecord.status === 'paid' ||
        (txId && orderRecord.xpay_transaction_id === txId)
      ) {
        res.status(200).json({ status: 'already_processed', idempotent: true });
        return;
      }

      // Verify paid amount matches canonical order amount_egp
      const reportedAmount =
        amount_egp !== undefined
          ? Number(amount_egp)
          : total_amount !== undefined
          ? Number(total_amount)
          : orderRecord.amount_egp;

      if (
        !Number.isFinite(reportedAmount) ||
        Math.abs(reportedAmount - orderRecord.amount_egp) > 0.01
      ) {
        res.status(400).json({
          error: `Payment amount mismatch: expected ${orderRecord.amount_egp} EGP, received ${reportedAmount} EGP`,
        });
        return;
      }

      const fulfilledAt = new Date().toISOString();
      orderRecord.status = 'paid';
      orderRecord.xpay_transaction_id = txId || `xpay_${Date.now()}`;
      orderRecord.fulfilled_at = fulfilledAt;
      inMemoryOrders.set(orderRecord.id, orderRecord);
      if (txId) {
        processedTransactions.add(txId);
      }

      if (sb) {
        await sb
          .from('orders')
          .update({
            status: 'paid',
            xpay_transaction_id: orderRecord.xpay_transaction_id,
            fulfilled_at: fulfilledAt,
            updated_at: fulfilledAt,
          })
          .eq('id', orderRecord.id)
          .neq('status', 'paid');
      }

    // Fetch protected deliverable file_url via server client (TASK-001)
    let fileUrl = orderRecord.product_snapshot?.file_url || '';
    let productNameAr = orderRecord.product_snapshot?.name_ar || dbProduct?.name_ar || '';
    let productNameEn = orderRecord.product_snapshot?.name_en || dbProduct?.name_en || '';

    if (sb && !fileUrl) {
      const { data: deliv } = await sb
        .from('product_deliverables')
        .select('file_url')
        .eq('product_id', orderRecord.product_id)
        .maybeSingle();
      if (deliv?.file_url) {
        fileUrl = deliv.file_url;
      }
    }

    if (sb && (!productNameAr || !productNameEn)) {
      const { data: prod } = await sb
        .from('products')
        .select('name_ar, name_en')
        .eq('id', orderRecord.product_id)
        .maybeSingle();
      if (prod) {
        productNameAr = prod.name_ar || productNameAr;
        productNameEn = prod.name_en || productNameEn;
      }
    }

    // Trigger n8n fulfillment webhook if configured (TASK-V02)
    const n8nWebhookUrl = process.env.N8N_FULFILLMENT_WEBHOOK_URL;
    let fulfillmentDispatched = false;
    if (n8nWebhookUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const n8nRes = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-Internal-Secret': process.env.N8N_WEBHOOK_SECRET || '',
          },
          body: JSON.stringify({
            order_id: orderRecord.id,
            customer_name: orderRecord.customer_name,
            customer_email: orderRecord.customer_email,
            customer_phone: orderRecord.customer_phone,
            product_name_ar: productNameAr,
            product_name_en: productNameEn,
            file_url: fileUrl,
            amount_egp: orderRecord.amount_egp,
            currency: 'EGP',
            transaction_id: orderRecord.xpay_transaction_id,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        fulfillmentDispatched = n8nRes.ok;
      } catch {
        fulfillmentDispatched = false;
      }
    }

      res.status(200).json({
        status: 'success',
        idempotent: false,
        order_id: orderRecord.id,
        fulfillment_dispatched: fulfillmentDispatched,
      });
    } finally {
      inFlightWebhookOrders.delete(orderKey);
    }
  } catch {
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

// ==========================================
// 3. AI Shopping Assistant Proxy (TASK-008)
// ==========================================
const DEFAULT_N8N_ASSISTANT_WEBHOOK_URL =
  'https://n8n-enginity.duckdns.org/webhook/agent-enginity-store';

function extractAssistantReply(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractAssistantReply(parsed) || trimmed;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const extracted = extractAssistantReply(item);
      if (extracted) return extracted;
    }
    return null;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidateKeys = [
      'output',
      'reply',
      'response',
      'message',
      'text',
      'answer',
      'content',
      'result',
      'data',
    ];
    for (const key of candidateKeys) {
      if (key in record) {
        const extracted = extractAssistantReply(record[key]);
        if (extracted) return extracted;
      }
    }
  }

  return null;
}

app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    // TASK-008: Strict IP rate limit of max 15 messages per 5 minutes (300_000 ms)
    if (!checkRateLimit(`assistant:${ip}`, 15, 5 * 60 * 1000)) {
      res.status(429).json({
        error:
          'لقد تجاوزت الحد المسموح للرسائل (15 رسالة كل 5 دقائق). يرجى الانتظار قليلاً ثم المحاولة مرة أخرى. / Rate limit exceeded (max 15 messages per 5 minutes).',
      });
      return;
    }

    const { message, sessionId, language, pathname, pageUrl } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const cleanMessage = message.trim();
    if (cleanMessage.length > 500) {
      res.status(400).json({
        error:
          language === 'ar'
            ? 'الرسالة طويلة جداً (الحد الأقصى 500 حرف).'
            : 'Message exceeds maximum length of 500 characters.',
      });
      return;
    }

    const webhookUrl =
      process.env.N8N_ASSISTANT_WEBHOOK_URL || DEFAULT_N8N_ASSISTANT_WEBHOOK_URL;

    // TASK-008: 10-second AbortController timeout on upstream n8n fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let webhookRes: globalThis.Response;
    try {
      webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
        body: JSON.stringify({
          message: cleanMessage,
          chatInput: cleanMessage,
          query: cleanMessage,
          sessionId: typeof sessionId === 'string' && sessionId ? sessionId : 'anonymous',
          language: language === 'en' ? 'en' : 'ar',
          pathname: typeof pathname === 'string' ? pathname : '/',
          pageUrl: typeof pageUrl === 'string' ? pageUrl : '',
          source: 'enginity-store-web',
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = await webhookRes.text();
    if (!webhookRes.ok) {
      res.status(502).json({
        error:
          language === 'ar'
            ? 'تعذر الوصول إلى المساعد الذكي حالياً. يرجى المحاولة مرة أخرى.'
            : 'Assistant service is temporarily unavailable.',
      });
      return;
    }

    const reply = extractAssistantReply(rawText);
    if (!reply) {
      res.status(502).json({
        error:
          language === 'ar'
            ? 'لم يتم استلام رد صالح من المساعد الذكي.'
            : 'Assistant returned an empty response.',
      });
      return;
    }

    res.status(200).json({ reply });
  } catch (error: any) {
    const isAbort = error?.name === 'AbortError';
    res.status(isAbort ? 504 : 500).json({
      error: isAbort
        ? 'Assistant request timed out after 10 seconds.'
        : 'Failed to communicate with AI Assistant',
    });
  }
});

// ==========================================
// 4. Public Relational CRM Endpoints (TASK-006, TASK-007)
// ==========================================
app.post('/api/waitlist', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(`waitlist:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
      return;
    }

    if (isHoneypotTriggered(req.body || {})) {
      res.status(200).json({ success: true, alreadyRegistered: false });
      return;
    }

    const parsed = waitlistSubmissionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid waitlist input' });
      return;
    }

    const sb = await getAdminWriteSupabaseClient();
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { product_id, email, whatsapp_number, email_consent, whatsapp_consent } = parsed.data;
    const dedupeKey = `${product_id}::${email || whatsapp_number}`;
    const lastTs = recentWaitlistServerMap.get(dedupeKey) || 0;
    if (Date.now() - lastTs < 300_000) {
      res.status(200).json({ success: true, alreadyRegistered: true });
      return;
    }

    // Verify product exists and is eligible for waitlist (coming_soon + waitlist_enabled)
    const { data: prod } = await sb
      .from('products')
      .select('id, status, waitlist_enabled')
      .eq('id', product_id)
      .maybeSingle();

    if (prod && (prod.status !== 'coming_soon' || prod.waitlist_enabled === false)) {
      res.status(400).json({
        error: 'Waitlist is only available for upcoming products with waitlist enabled.',
      });
      return;
    }

    // Check duplicate email for the same product
    if (email) {
      const { data: existing } = await sb
        .from('product_waitlist')
        .select('id')
        .eq('product_id', product_id)
        .ilike('email', email)
        .maybeSingle();

      if (existing) {
        recentWaitlistServerMap.set(dedupeKey, Date.now());
        res.status(200).json({ success: true, alreadyRegistered: true });
        return;
      }
    }

    const { error } = await sb.from('product_waitlist').insert({
      product_id,
      email: email || '',
      whatsapp_number: whatsapp_number || '',
      email_consent: email ? (email_consent ?? true) : false,
      whatsapp_consent: whatsapp_number ? (whatsapp_consent ?? true) : false,
      consent_text_ar: 'موافقة صريحة على استلام إشعار إطلاق المنتج',
      consent_text_en: 'Explicit consent to receive product launch notification',
    });

    if (error) {
      if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate')) {
        recentWaitlistServerMap.set(dedupeKey, Date.now());
        res.status(200).json({ success: true, alreadyRegistered: true });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    recentWaitlistServerMap.set(dedupeKey, Date.now());
    res.status(200).json({ success: true, alreadyRegistered: false });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to join waitlist' });
  }
});

app.post('/api/custom-requests', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(`custom-req:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }

    if (isHoneypotTriggered(req.body || {})) {
      res.status(200).json({ success: true });
      return;
    }

    const parsed = customRequestSubmissionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request input' });
      return;
    }

    const sb = await getAdminWriteSupabaseClient();
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const d = parsed.data;
    const resolvedName = (d.full_name || d.name || '').trim();
    const resolvedType = (d.business_type || d.industry || d.brand_name || 'General Business').trim();
    const resolvedProblem = (
      d.business_problem ||
      d.pain_points ||
      d.business_description ||
      d.automation_goal ||
      d.desired_outcome ||
      ''
    ).trim();
    const resolvedOutcome = (
      d.desired_outcome ||
      d.automation_goal ||
      resolvedProblem
    ).trim();
    const resolvedTools =
      Array.isArray(d.current_tools) && d.current_tools.length > 0
        ? d.current_tools
        : Array.isArray(d.platforms_involved)
        ? d.platforms_involved
        : [];

    const dedupeKey = `${d.email}::${resolvedProblem.toLowerCase()}::${resolvedOutcome.toLowerCase()}`;
    const lastTs = recentCustomReqServerMap.get(dedupeKey) || 0;
    if (Date.now() - lastTs < 60_000) {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }

    const insertPayload = {
      name: resolvedName,
      email: d.email,
      whatsapp_number: d.whatsapp_number || '',
      business_type: resolvedType,
      business_problem: resolvedProblem,
      desired_outcome: resolvedOutcome,
      current_tools: resolvedTools,
      expected_features: d.expected_features || d.current_workflow || '',
      budget_range: d.budget_range || '',
      delivery_timeframe: d.delivery_timeframe || d.timeline_urgency || '',
      additional_notes: d.additional_notes || '',
      marketing_consent: d.marketing_consent ?? true,
      status: 'new',
    };

    const { data, error } = await sb
      .from('custom_automation_requests')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    recentCustomReqServerMap.set(dedupeKey, Date.now());
    res.status(200).json({ success: true, duplicate: false, item: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to submit custom request' });
  }
});

app.post('/api/product-suggestions', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(`suggestion:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }

    if (isHoneypotTriggered(req.body || {})) {
      res.status(200).json({ success: true, duplicate: false });
      return;
    }

    const parsed = productSuggestionSubmissionSchema.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid suggestion input' });
      return;
    }

    const sb = await getAdminWriteSupabaseClient();
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { website_url: _hp, ...insertPayload } = parsed.data;
    const fingerprint = `${insertPayload.proposed_name.toLowerCase()}::${insertPayload.problem_solved
      .slice(0, 80)
      .toLowerCase()}`;

    const contactKey = (insertPayload.email || insertPayload.whatsapp_number || ip).toLowerCase();
    const dedupeKey = `${contactKey}::${fingerprint}`;
    const lastTs = recentSuggestionServerMap.get(dedupeKey) || 0;
    if (Date.now() - lastTs < 60_000) {
      res.status(200).json({ success: true, duplicate: true });
      return;
    }

    const { data, error } = await sb
      .from('product_suggestions')
      .insert({
        ...insertPayload,
        fingerprint_hash: fingerprint,
        status: 'under_review',
      })
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    recentSuggestionServerMap.set(dedupeKey, Date.now());
    res.status(200).json({ success: true, duplicate: false, item: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to submit suggestion' });
  }
});

app.get('/api/reviews', async (req: Request, res: Response) => {
  try {
    const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    const sb = await getAdminWriteSupabaseClient();
    if (!sb) {
      res.status(200).json({ items: [] });
      return;
    }

    let query = sb
      .from('product_reviews')
      .select('id, product_id, customer_name, rating, review_text, status, created_at, updated_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (productId) {
      query = query.eq('product_id', productId);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ items: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch reviews' });
  }
});

app.post('/api/reviews', async (req: Request, res: Response) => {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(`reviews:${ip}`, 8, 60_000)) {
      res.status(429).json({ error: 'Too many review submissions. Please wait a minute.' });
      return;
    }

    if (isHoneypotTriggered(req.body || {})) {
      res.status(200).json({ success: true });
      return;
    }

    const parsed = reviewSubmissionSchema.safeParse({
      ...req.body,
      rating: Number(req.body?.rating),
    });

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid review input' });
      return;
    }

    const sb = await getAdminWriteSupabaseClient();
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { product_id, customer_name, rating, review_text } = parsed.data;
    const { data, error } = await sb
      .from('product_reviews')
      .insert({
        product_id,
        customer_name,
        rating,
        review_text,
        status: 'pending',
      })
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ success: true, item: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to submit review' });
  }
});

// ==========================================
// 5. Protected Admin API Routes (TASK-001, TASK-005)
// ==========================================
app.use('/api/admin', requireAdminAuth);

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function hasValidImageMagicBytes(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return true;
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return true;
  }
  // GIF: 47 49 46 38 ("GIF8")
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return true;
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return true;
  }
  return false;
}

// Admin Image Upload Proxy — strictly uses process.env.IMGBB_API_KEY (TASK-005)
app.post('/api/admin/upload-image', async (req: Request, res: Response) => {
  try {
    const { imageBase64, name } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      res.status(400).json({ error: 'Missing imageBase64 payload' });
      return;
    }

    // 1. Validate optional file name extension
    if (name && typeof name === 'string') {
      const extMatch = name.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
      if (extMatch && !ALLOWED_UPLOAD_EXTENSIONS.has(extMatch[1])) {
        res.status(400).json({
          error: `Unsupported file extension "${extMatch[1]}". Allowed: .png, .jpg, .jpeg, .webp, .gif`,
        });
        return;
      }
    }

    // 2. Validate MIME type header if data URI prefix is provided
    const dataUriMatch = imageBase64.trim().match(/^data:([^;]+);base64,([\s\S]+)$/i);
    let cleanBase64 = imageBase64.trim();
    if (dataUriMatch) {
      const mimeType = dataUriMatch[1].trim().toLowerCase();
      if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          error: `Unsupported image MIME type "${mimeType}". Allowed: image/png, image/jpeg, image/webp, image/gif`,
        });
        return;
      }
      cleanBase64 = dataUriMatch[2].trim();
    }

    // 3. Validate base64 syntax, decoded byte size, and binary magic bytes
    const normalizedB64 = cleanBase64.replace(/\s+/g, '');
    if (!normalizedB64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedB64)) {
      res.status(400).json({ error: 'Invalid base64 encoding' });
      return;
    }

    const decodedBuffer = Buffer.from(normalizedB64, 'base64');
    if (decodedBuffer.length === 0) {
      res.status(400).json({ error: 'Decoded image payload is empty' });
      return;
    }
    if (decodedBuffer.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({
        error: `Image exceeds maximum allowed size of 5 MB (${decodedBuffer.length} bytes)`,
      });
      return;
    }
    if (!hasValidImageMagicBytes(decodedBuffer)) {
      res.status(400).json({
        error: 'Invalid image content: binary file header does not match PNG, JPEG, WebP, or GIF',
      });
      return;
    }

    const imgbbKey = process.env.IMGBB_API_KEY;
    if (!imgbbKey || !imgbbKey.trim()) {
      res.status(503).json({ error: 'IMGBB_API_KEY is not configured on the server' });
      return;
    }

    const formBody = new URLSearchParams();
    formBody.append('key', imgbbKey.trim());
    formBody.append('image', normalizedB64);
    if (name && typeof name === 'string') {
      formBody.append('name', name.replace(/\.[^/.]+$/, '').slice(0, 64));
    }

    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    const result: any = await response.json();
    if (!response.ok || !result?.success || !result?.data?.url) {
      res.status(502).json({
        error: result?.error?.message || 'ImgBB upload failed',
      });
      return;
    }

    res.status(200).json({
      url: result.data.display_url || result.data.url,
      delete_url: result.data.delete_url,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to upload image' });
  }
});

// Admin Products CRUD with Protected Deliverables (TASK-001, TASK-004)
app.get('/api/admin/products', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const { data: products, error } = await sb
      .from('products')
      .select('*, category:categories(*)')
      .order('sort_order', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const { data: deliverables } = await sb
      .from('product_deliverables')
      .select('product_id, file_url');

    const delivMap = new Map<string, string>();
    for (const d of deliverables || []) {
      if (d?.product_id) {
        delivMap.set(d.product_id, d.file_url || '');
      }
    }

    const items = (products || []).map((p: any) => ({
      ...p,
      file_url: delivMap.get(p.id) ?? p.file_url ?? '',
    }));

    res.status(200).json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to load admin products' });
  }
});

async function saveDeliverableUrl(sb: SupabaseClient, productId: string, fileUrl?: string) {
  if (fileUrl === undefined) return;
  try {
    await sb.from('product_deliverables').upsert(
      {
        product_id: productId,
        file_url: String(fileUrl || '').trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'product_id' }
    );
  } catch {
    // Ignore if table not yet migrated in remote DB
  }
}

function normalizeIncomingProductPricing(payload: Record<string, any>) {
  const copy: Record<string, any> = { ...payload };
  delete copy.id;
  delete copy.created_at;
  delete copy.category;
  delete copy.file_url;
  delete copy.discount_percentage;

  const rawOrig =
    copy.original_price_egp !== undefined && copy.original_price_egp !== null
      ? Number(copy.original_price_egp)
      : Number(copy.price_egp);
  const originalPriceEgp = Number.isFinite(rawOrig) && rawOrig >= 0 ? rawOrig : 0;

  const rawSale =
    copy.sale_price_egp !== undefined &&
    copy.sale_price_egp !== null &&
    String(copy.sale_price_egp).trim() !== ''
      ? Number(copy.sale_price_egp)
      : null;

  if (rawSale !== null && Number.isFinite(rawSale) && rawSale > 0) {
    if (rawSale >= originalPriceEgp) {
      throw new Error('Discounted price must be strictly less than original price');
    }
    copy.original_price_egp = originalPriceEgp;
    copy.sale_price_egp = rawSale;
    copy.price_egp = rawSale;
  } else {
    copy.original_price_egp = originalPriceEgp;
    copy.sale_price_egp = null;
    copy.price_egp = originalPriceEgp;
  }

  return copy;
}

app.post('/api/admin/products', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const fileUrl = typeof req.body?.file_url === 'string' ? req.body.file_url.trim() : '';
    const dbPayload = normalizeIncomingProductPricing(req.body || {});
    dbPayload.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from('products')
      .insert(dbPayload)
      .select('*, category:categories(*)')
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (data?.id) {
      await saveDeliverableUrl(sb, data.id, fileUrl);
    }

    res.status(200).json({ item: { ...data, file_url: fileUrl } });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to create product' });
  }
});

app.put('/api/admin/products/:id', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const productId = req.params.id;
    const fileUrl =
      typeof req.body?.file_url === 'string' ? req.body.file_url.trim() : undefined;
    const dbPayload = normalizeIncomingProductPricing(req.body || {});
    dbPayload.updated_at = new Date().toISOString();

    const { data, error } = await sb
      .from('products')
      .update(dbPayload)
      .eq('id', productId)
      .select('*, category:categories(*)')
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await saveDeliverableUrl(sb, productId, fileUrl);

    res.status(200).json({
      item: {
        ...data,
        file_url: fileUrl ?? '',
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update product' });
  }
});

app.delete('/api/admin/products/:id', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }

    const productId = req.params.id;
    const { error } = await sb.from('products').delete().eq('id', productId);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete product' });
  }
});

// Admin CRM & Reviews Endpoints (TASK-005, TASK-006)
app.get('/api/admin/custom-requests', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { data, error } = await sb
      .from('custom_automation_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ items: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch custom requests' });
  }
});

app.put('/api/admin/custom-requests/:id', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { status, admin_notes } = req.body || {};
    const { data, error } = await sb
      .from('custom_automation_requests')
      .update({
        ...(status ? { status } : {}),
        ...(admin_notes !== undefined ? { admin_notes } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(200).json({ item: data });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update custom request' });
  }
});

app.get('/api/admin/product-suggestions', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { data, error } = await sb
      .from('product_suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ items: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch product suggestions' });
  }
});

app.put('/api/admin/product-suggestions/:id', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { status, admin_notes, converted_product_id } = req.body || {};
    const { data, error } = await sb
      .from('product_suggestions')
      .update({
        ...(status ? { status } : {}),
        ...(admin_notes !== undefined ? { admin_notes } : {}),
        ...(converted_product_id !== undefined ? { converted_product_id } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(200).json({ item: data });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update product suggestion' });
  }
});

app.get('/api/admin/reviews', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { data, error } = await sb
      .from('product_reviews')
      .select('*, product:products(id, slug, name_ar, name_en, cover_path)')
      .order('created_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ items: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch admin reviews' });
  }
});

app.put('/api/admin/reviews/:id', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { status } = req.body || {};
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Invalid review status' });
      return;
    }
    const { data, error } = await sb
      .from('product_reviews')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(200).json({ item: data });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to update review status' });
  }
});

app.delete('/api/admin/reviews/:id', async (req: Request, res: Response) => {
  try {
    const sb = await getAdminWriteSupabaseClient(req);
    if (!sb) {
      res.status(503).json({ error: 'Database not configured' });
      return;
    }
    const { error } = await sb.from('product_reviews').delete().eq('id', req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to delete review' });
  }
});

// ==========================================
// 6. Catch-All Unmatched /api/* JSON 404 (TASK-002)
// ==========================================
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ==========================================
// 7. Dev / Production Server Bootstrap
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL && !process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startServer();
}
