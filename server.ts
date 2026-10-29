import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import {
  fetchCategories,
  fetchProducts,
  fetchProductBySlug,
  fetchSettings,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  updateStoreSettings,
  processProductLaunch
} from './src/lib/data-store';
import {
  createCustomAutomationRequest,
  listCustomAutomationRequests,
  updateCustomAutomationRequest,
  createProductSuggestion,
  listProductSuggestions,
  updateProductSuggestion,
  computeDemandAnalytics
} from './src/lib/crm-store';
import { processAssistantTurn } from './src/lib/assistant-engine';
import { validateXPayUrl, normalizeDateToIso } from './src/lib/utils';
import { isSupabaseConfigured, getSupabaseAdmin, getSystemAdminSupabase, supabase } from './src/lib/supabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 1. Helmet-style Security Headers & CSP
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (req.path.startsWith('/admin') || req.path.startsWith('/api/admin')) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; connect-src 'self' https: wss:;"
    );
  }
  next();
});

// Simple In-Memory Rate Limiter for Admin Routes
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const ADMIN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const ADMIN_MAX_REQUESTS = 40; // 40 requests per minute

const adminRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + ADMIN_RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (record.count >= ADMIN_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
  }

  record.count += 1;
  next();
};

// Admin Authentication via Supabase Auth + admins table check
const SUPABASE_AUTH_COOKIE = 'enginity_sb_token';

async function verifyAdminUser(token: string): Promise<{ userId: string; email?: string } | null> {
  if (!supabase) return null;

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) return null;

    const userId = userData.user.id;
    const adminSb = getSupabaseAdmin(token);
    if (!adminSb) return null;

    // Verify user exists in admins table
    const { data: adminRow, error: adminError } = await adminSb
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (adminError || !adminRow) return null;

    return { userId, email: userData.user.email };
  } catch (err: any) {
    console.error('verifyAdminUser error:', err);
    return null;
  }
}

const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const match = cookies.find(c => c.startsWith(`${SUPABASE_AUTH_COOKIE}=`));
    if (match) {
      token = match.split('=')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthenticated admin session.' });
  }

  const admin = await verifyAdminUser(token);
  if (!admin) {
    return res.status(403).json({ error: 'Forbidden. Non-admin account.' });
  }

  (req as any).adminUser = admin;
  (req as any).adminToken = token;
  next();
};

// 2. PUBLIC API ENDPOINTS

app.get('/api/categories', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const categories = await fetchCategories();
    res.json({ categories });
  } catch {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

app.get('/api/settings', async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    const settings = await fetchSettings();
    res.json({ settings });
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const categoryId = req.query.cat ? Number(req.query.cat) : undefined;
    const searchQuery = req.query.q ? String(req.query.q) : undefined;

    let includeDrafts = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const admin = await verifyAdminUser(token);
      if (admin && req.query.drafts === 'true') {
        includeDrafts = true;
      }
    }

    if (!includeDrafts) {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=300');
    }

    const products = await fetchProducts({
      publishedOnly: !includeDrafts,
      categoryId,
      searchQuery
    });

    res.json({ products });
  } catch {
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
});

app.get('/api/products/:slug', async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug;
    let includeDrafts = false;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const admin = await verifyAdminUser(token);
      if (admin) includeDrafts = true;
    }

    const product = await fetchProductBySlug(slug, !includeDrafts);

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    res.json({ product });
  } catch {
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
});

// Phone Number Normalization Helper (E.164 with Egypt +20 support)
function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('01') && cleaned.length === 11) {
      cleaned = '+20' + cleaned.slice(1);
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return cleaned;
}

// 2B. WAITLIST PUBLIC REGISTRATION ENDPOINT
const waitlistRegisterSchema = z.object({
  productId: z.string().uuid(),
  email: z.string().email().optional().or(z.literal('')),
  whatsappNumber: z.string().optional().or(z.literal('')),
  emailConsent: z.boolean().default(false),
  whatsappConsent: z.boolean().default(false),
  lang: z.enum(['ar', 'en']).default('ar')
});

app.post('/api/waitlist/register', async (req: Request, res: Response) => {
  try {
    const parsed = waitlistRegisterSchema.parse(req.body);
    const { productId, emailConsent, whatsappConsent, lang } = parsed;

    const email = parsed.email ? parsed.email.trim().toLowerCase() : '';
    const rawWhatsapp = parsed.whatsappNumber ? parsed.whatsappNumber.trim() : '';
    const normalizedWhatsapp = rawWhatsapp ? normalizePhoneNumber(rawWhatsapp) : '';

    if (!emailConsent && !whatsappConsent) {
      return res.status(400).json({
        error: lang === 'ar' ? 'يرجى اختيار وسيلة تنبيه واحدة على الأقل والموافقة عليها.' : 'Please select at least one notification channel with explicit consent.'
      });
    }

    if (emailConsent && !email) {
      return res.status(400).json({
        error: lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح لطلب التنبيه.' : 'Please enter a valid email address.'
      });
    }

    if (whatsappConsent && (!normalizedWhatsapp || normalizedWhatsapp.length < 8)) {
      return res.status(400).json({
        error: lang === 'ar' ? 'يرجى إدخال رقم واتساب صحيح مصحوباً بكود الدولة.' : 'Please enter a valid WhatsApp phone number with country code.'
      });
    }

    const adminSb = await getSystemAdminSupabase();
    if (!adminSb) {
      return res.status(503).json({ error: 'Database service unavailable.' });
    }

    // Verify product exists, is coming_soon, and has waitlist_enabled = true
    const { data: product, error: prodError } = await adminSb
      .from('products')
      .select('id, name_ar, name_en, status, waitlist_enabled')
      .eq('id', productId)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ error: lang === 'ar' ? 'المنتج غير موجود.' : 'Product not found.' });
    }

    if (product.status !== 'coming_soon') {
      return res.status(400).json({
        error: lang === 'ar' ? 'هذا المنتج ليس في قائمة المنتجات القادمة قريباً.' : 'This product is not currently in Coming Soon status.'
      });
    }

    if (product.waitlist_enabled === false) {
      return res.status(400).json({
        error: lang === 'ar' ? 'تسجيل قائمة الانتظار مغلق حالياً لهذا المنتج.' : 'Waitlist registration is currently disabled for this product.'
      });
    }

    const consentTextAr = 'أوافق على استلام إشعار عند إطلاق وتوفر هذا المنتج للشراء عبر القنوات المحددة.';
    const consentTextEn = 'I agree to receive a launch notification when this product becomes available via the selected channels.';

    // Check for existing registration for idempotency
    let existingQuery = adminSb.from('product_waitlist').select('id, email_consent, whatsapp_consent').eq('product_id', productId);
    if (email) {
      existingQuery = existingQuery.eq('email', email);
    } else if (normalizedWhatsapp) {
      existingQuery = existingQuery.eq('whatsapp_number', normalizedWhatsapp);
    }

    const { data: existingRows } = await existingQuery;

    if (existingRows && existingRows.length > 0) {
      const existingId = existingRows[0].id;
      const { error: updateError } = await adminSb
        .from('product_waitlist')
        .update({
          email: email || undefined,
          whatsapp_number: normalizedWhatsapp || undefined,
          email_consent: emailConsent || existingRows[0].email_consent,
          whatsapp_consent: whatsappConsent || existingRows[0].whatsapp_consent,
          consent_text_ar: consentTextAr,
          consent_text_en: consentTextEn,
          consent_timestamp: new Date().toISOString()
        })
        .eq('id', existingId);

      if (updateError) {
        return res.status(500).json({ error: 'Failed to update waitlist entry.' });
      }

      return res.json({
        success: true,
        alreadyRegistered: true,
        message: lang === 'ar'
          ? 'أنت مسجل بالفعل في قائمة الانتظار لهذا المنتج، وسنقوم بتنبيهك عبر البريد الإلكتروني والواتساب بمجرد الإطلاق المباشر 🚀'
          : 'You are already registered on the waitlist for this product! We will notify you via Email and WhatsApp as soon as it launches 🚀',
        registrationId: existingId
      });
    }

    // Insert new waitlist registration
    const { data: newEntry, error: insertError } = await adminSb
      .from('product_waitlist')
      .insert({
        product_id: productId,
        email: email,
        whatsapp_number: normalizedWhatsapp,
        email_consent: emailConsent,
        whatsapp_consent: whatsappConsent,
        consent_text_ar: consentTextAr,
        consent_text_en: consentTextEn,
        consent_timestamp: new Date().toISOString(),
        email_status: emailConsent ? 'pending' : 'withdrawn',
        whatsapp_status: whatsappConsent ? 'pending' : 'withdrawn'
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Waitlist insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save waitlist registration.', details: insertError });
    }

    return res.json({
      success: true,
      alreadyRegistered: false,
      message: lang === 'ar' ? 'تم تسجيل طلب التنبيه الخاص بك بنجاح! وسنقوم بتنبيهك عبر البريد الإلكتروني والواتساب بمجرد الإطلاق المباشر 🚀' : 'You will receive a notification as soon as this product launches!',
      registrationId: newEntry?.id
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid payload parameters.', details: err.issues });
    }
    return res.status(500).json({ error: 'Server error processing waitlist registration.', details: err.message || err });
  }
});

// 3. ADMIN AUTH & API ENDPOINTS (Rate limited, Zod validated)

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

app.post('/api/admin/login', adminRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    if (!isSupabaseConfigured() || !supabase) {
      return res.status(503).json({
        error: 'Supabase credentials missing in environment.'
      });
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.session || !authData.user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const userId = authData.user.id;
    const adminSb = getSupabaseAdmin(authData.session.access_token);
    if (!adminSb) {
      return res.status(500).json({ error: 'Supabase admin client not initialized.' });
    }

    const { data: adminRow, error: adminError } = await adminSb
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (adminError || !adminRow) {
      console.error('Admin verification error:', adminError, 'adminRow:', adminRow, 'userId:', userId);
      return res.status(403).json({ error: 'Access denied. Non-admin account.' });
    }

    res.cookie(SUPABASE_AUTH_COOKIE, authData.session.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/'
    });

    res.json({
      success: true,
      token: authData.session.access_token,
      user: { id: userId, email: authData.user.email }
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Invalid request payload', details: err.message });
  }
});

app.get('/api/admin/me', adminRateLimiter, async (req: Request, res: Response) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const match = cookies.find(c => c.startsWith(`${SUPABASE_AUTH_COOKIE}=`));
    if (match) {
      token = match.split('=')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ authenticated: false });
  }

  const admin = await verifyAdminUser(token);
  if (!admin) {
    return res.status(401).json({ authenticated: false });
  }

  res.json({ authenticated: true, user: admin });
});

app.post('/api/admin/logout', (req: Request, res: Response) => {
  res.clearCookie(SUPABASE_AUTH_COOKIE, { path: '/' });
  res.json({ success: true });
});

// Zod Validation Schema for Product Write
const nullableString = z.string().nullable().optional().transform(v => {
  if (v === undefined || v === null || typeof v !== 'string' || v.trim() === '') return null;
  return v.trim();
});

const nullableDate = z.string().nullable().optional().transform(v => normalizeDateToIso(v));

const productInputSchema = z.object({
  id: z.string().optional(),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(['draft', 'published', 'coming_soon', 'archived']),
  category_id: z.coerce.number(),
  price_egp: z.coerce.number().min(0),
  xpay_url: nullableString.refine(url => !url || validateXPayUrl(url), {
    message: 'xpay_url must be a valid https URL (and match XPAY_ALLOWED_HOSTS if set).'
  }),
  short_ar: nullableString,
  short_en: nullableString,
  description_ar: nullableString,
  description_en: nullableString,
  cover_path: nullableString,
  diagram_path: nullableString,
  video_url: nullableString,
  tools: z.array(z.string()).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']),
  includes_ar: z.array(z.string()).optional(),
  includes_en: z.array(z.string()).optional(),
  requirements_ar: z.array(z.any()).optional(),
  requirements_en: z.array(z.any()).optional(),
  steps_ar: z.array(z.any()).optional(),
  steps_en: z.array(z.any()).optional(),
  faq: z.array(z.any()).optional(),
  sort_order: z.coerce.number().optional(),
  expected_launch_date: nullableDate,
  launch_announcement: nullableString,
  waitlist_enabled: z.boolean().optional(),
  admin_notes: nullableString
});

app.post('/api/admin/products', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const validated = productInputSchema.parse(req.body);
    if (!validated.id) {
      delete (validated as any).id;
    }
    const token = (req as any).adminToken;
    const created = await createProduct(validated, token);
    if (!created) {
      return res.status(500).json({ error: 'Failed to create product in database.' });
    }
    res.status(201).json({ product: created });
  } catch (err: any) {
    console.error('Error creating product:', err);
    res.status(400).json({ error: 'Validation or creation failed', details: err.issues || err.errors || err.message });
  }
});

app.put('/api/admin/products/:id', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const validated = productInputSchema.partial().parse(req.body);
    const token = (req as any).adminToken;
    const updated = await updateProduct(id, validated, token);
    if (!updated) {
      return res.status(404).json({ error: 'Product not found or update failed.' });
    }
    res.json({ product: updated });
  } catch (err: any) {
    console.error('Error updating product:', err);
    res.status(400).json({ error: 'Validation or update failed', details: err.issues || err.errors || err.message });
  }
});

app.delete('/api/admin/products/:id', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const token = (req as any).adminToken;
    const ok = await deleteProduct(id, token);
    if (!ok) {
      return res.status(404).json({ error: 'Product not found or delete failed.' });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

app.post('/api/admin/categories', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const token = (req as any).adminToken;
    const created = await createCategory(req.body, token);
    res.status(201).json({ category: created });
  } catch (err: any) {
    res.status(400).json({ error: 'Create category failed', details: err.message });
  }
});

app.put('/api/admin/categories/:id', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const token = (req as any).adminToken;
    const updated = await updateCategory(id, req.body, token);
    res.json({ category: updated });
  } catch (err: any) {
    res.status(400).json({ error: 'Update category failed', details: err.message });
  }
});

app.delete('/api/admin/categories/:id', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const token = (req as any).adminToken;
    const ok = await deleteCategory(id, token);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: 'Delete category failed', details: err.message });
  }
});

app.put('/api/admin/settings', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const token = (req as any).adminToken;
    const updated = await updateStoreSettings(req.body, token);
    res.json({ settings: updated });
  } catch {
    res.status(500).json({ error: 'Update settings failed.' });
  }
});

// 4. ADMIN WAITLIST & LAUNCH NOTIFICATION ENDPOINTS

async function sendEmailLaunchNotification(recipientEmail: string, product: any, appUrl: string): Promise<{ success: boolean; providerId?: string; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const productUrl = `${appUrl}/ar/products/${product.slug}`;
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'ENGINITY <notifications@enginity.store>',
          to: [recipientEmail],
          subject: `⚡ تم إطلاق المنتج: ${product.name_ar}`,
          html: `
            <div style="font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px; background-color: #f8fafc; color: #0b1f3a;">
              <h2 style="color: #2f6bff;">خبر سار! تم توفير منتج الأتمتة الذي انتظرته 🚀</h2>
              <h3 style="font-size: 20px; color: #0b1f3a;">${product.name_ar}</h3>
              <p style="font-size: 15px; color: #475569; line-height: 1.7;">${product.short_ar || ''}</p>
              ${product.launch_announcement ? `<p style="padding: 12px; background: #e0e7ff; border-radius: 8px; color: #1e1b4b;"><strong>تنويه الإطلاق:</strong> ${product.launch_announcement}</p>` : ''}
              <div style="margin-top: 24px;">
                <a href="${productUrl}" style="background-color: #2f6bff; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 10px; display: inline-block;">احصل على الـ Workflow الآن ⚡</a>
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">وصلتك هذه الرسالة لأنك طلبت التنبيه عند إطلاق هذا المنتج على متجر ENGINITY.</p>
            </div>
          `
        })
      });
      const data: any = await response.json();
      if (response.ok && data.id) {
        return { success: true, providerId: data.id };
      }
      return { success: false, error: data.message || 'Resend dispatch failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Resend error' };
    }
  }

  return {
    success: false,
    error: 'Email provider credentials (RESEND_API_KEY) not configured in server environment.'
  };
}

async function sendWhatsAppLaunchNotification(phone: string, product: any, appUrl: string): Promise<{ success: boolean; providerId?: string; error?: string }> {
  const token = process.env.WHATSAPP_CLOUD_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const n8nWebhook = process.env.N8N_WHATSAPP_WEBHOOK_URL;

  if (n8nWebhook) {
    try {
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'product_launch',
          recipient_phone: phone,
          product_id: product.id,
          product_name_ar: product.name_ar,
          product_url: `${appUrl}/ar/products/${product.slug}`,
          launch_announcement: product.launch_announcement || ''
        })
      });
      if (response.ok) {
        return { success: true, providerId: 'n8n_webhook_dispatched' };
      }
    } catch (err: any) {
      console.error('N8N WhatsApp webhook dispatch failed:', err);
    }
  }

  if (token && phoneNumberId) {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace('+', ''),
          type: 'text',
          text: {
            body: `⚡ تم إطلاق المنتج الجديد: ${product.name_ar}\n\n${product.short_ar || ''}\n\nاحصل عليه الآن عبر الرابط:\n${appUrl}/ar/products/${product.slug}`
          }
        })
      });
      const data: any = await response.json();
      if (response.ok && data.messages?.[0]?.id) {
        return { success: true, providerId: data.messages[0].id };
      }
      return { success: false, error: data.error?.message || 'Meta Cloud API error' };
    } catch (err: any) {
      return { success: false, error: err.message || 'WhatsApp Cloud API error' };
    }
  }

  return {
    success: false,
    error: 'WhatsApp provider credentials (WHATSAPP_CLOUD_API_TOKEN / N8N_WHATSAPP_WEBHOOK_URL) not configured in server environment.'
  };
}

// Admin API to fetch waitlist entries and statistics
app.get('/api/admin/waitlist/:productId', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    const adminSb = await getSystemAdminSupabase();
    if (!adminSb) return res.status(503).json({ error: 'Database client uninitialized.' });

    const { data: entries, error } = await adminSb
      .from('product_waitlist')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch waitlist records.' });
    }

    const rows = entries || [];
    const stats = {
      total_subscribers: rows.length,
      email_count: rows.filter(r => r.email_consent && r.email).length,
      whatsapp_count: rows.filter(r => r.whatsapp_consent && r.whatsapp_number).length,
      pending_count: rows.filter(r => r.email_status === 'pending' || r.whatsapp_status === 'pending').length,
      sent_count: rows.filter(r => r.email_status === 'sent' || r.whatsapp_status === 'sent').length,
      failed_count: rows.filter(r => r.email_status === 'failed' || r.whatsapp_status === 'failed').length
    };

    res.json({ entries: rows, stats });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch waitlist stats.' });
  }
});

// Admin API to Publish product and dispatch launch notifications idempotently
app.post('/api/admin/products/:productId/launch', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    const adminSb = await getSystemAdminSupabase();
    if (!adminSb) return res.status(503).json({ error: 'Database client uninitialized.' });

    const originUrl = `${req.protocol}://${req.get('host')}`;
    const result = await processProductLaunch(adminSb, productId, originUrl);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Launch processing failed', details: err.message });
  }
});

// Serve public uploads directory
const publicUploadsDirectory = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(publicUploadsDirectory)) {
  fs.mkdirSync(publicUploadsDirectory, { recursive: true });
}
app.use('/public/uploads', express.static(publicUploadsDirectory));
app.use('/uploads', express.static(publicUploadsDirectory));

// Image upload via ImgBB with Supabase Storage & Local Fallbacks
import multer from 'multer';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

function isValidImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // WEBP: RIFF....WEBP
  if (
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) return true;

  return false;
}

app.post('/api/admin/upload-image', adminRateLimiter, requireAdmin, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'لم يتم تحديد أي ملف صورة للرفع.' });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: 'حجم الصورة يتجاوز الحد المسموح به (5 ميجابايت). يرجى اختيار صورة أصغر.'
      });
    }

    if (!isValidImageMagicBytes(file.buffer)) {
      return res.status(400).json({
        error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPEG أو PNG أو WEBP فقط.'
      });
    }

    const slug = (req.body?.slug || 'product').toString().replace(/[^a-z0-9_-]/gi, '');
    const purpose = (req.body?.purpose || 'image').toString().replace(/[^a-z0-9_-]/gi, '');
    const customName = `${slug}_${purpose}_${Date.now()}`;
    const ext = file.mimetype.split('/')[1] || 'png';
    const filename = `${customName}.${ext}`;

    let directUrl: string | null = null;
    let uploadSource = '';

    // Strategy 1: ImgBB API
    const apiKey = (process.env.IMGBB_API_KEY || 'e006ebcf750e5849df32660282d17a9e').trim();
    if (apiKey) {
      try {
        const base64Image = file.buffer.toString('base64');
        const formData = new URLSearchParams();
        formData.append('image', base64Image);
        formData.append('name', customName);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (imgbbRes.ok) {
          const json = await imgbbRes.json();
          if (json && json.success && json.data && json.data.url) {
            directUrl = json.data.url;
            uploadSource = 'imgbb';
          }
        }
      } catch (e) {
        console.warn('ImgBB upload attempt failed, trying fallbacks:', e);
      }
    }

    // Strategy 2: Supabase Storage Bucket ('product-media' or 'public')
    if (!directUrl && isSupabaseConfigured()) {
      try {
        const adminSb = getSupabaseAdmin() || supabase;
        if (adminSb) {
          const { data: uploadData, error: uploadErr } = await adminSb.storage
            .from('product-media')
            .upload(filename, file.buffer, {
              contentType: file.mimetype,
              upsert: true
            });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = adminSb.storage
              .from('product-media')
              .getPublicUrl(filename);

            if (publicUrlData && publicUrlData.publicUrl) {
              directUrl = publicUrlData.publicUrl;
              uploadSource = 'supabase';
            }
          }
        }
      } catch (e) {
        console.warn('Supabase storage upload failed, trying local fallback:', e);
      }
    }

    // Strategy 3: Local Server Storage (/public/uploads/)
    if (!directUrl) {
      try {
        const uploadsDir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers.host || 'localhost:3000';
        directUrl = `${protocol}://${host}/uploads/${filename}`;
        uploadSource = 'local';
      } catch (e) {
        console.error('Local file save failed:', e);
      }
    }

    if (!directUrl) {
      return res.status(500).json({ error: 'تعذّر رفع أو حفظ الصورة. يرجى المحاولة لاحقاً.' });
    }

    return res.json({
      url: directUrl,
      source: uploadSource
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'تعذّر رفع الصورة، حاول مرة تانية.' });
  }
});

// 3B. EVOLUTION FEATURES: AI SHOPPING ASSISTANT, CUSTOM REQUESTS & PRODUCT SUGGESTIONS

const publicSubmissionRateMap = new Map<string, { count: number; resetTime: number }>();
const PUBLIC_SUBMISSION_WINDOW_MS = 60 * 1000;
const PUBLIC_SUBMISSION_MAX = 25;

const publicSubmissionRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = publicSubmissionRateMap.get(ip);
  if (!rec || now > rec.resetTime) {
    publicSubmissionRateMap.set(ip, { count: 1, resetTime: now + PUBLIC_SUBMISSION_WINDOW_MS });
    return next();
  }
  if (rec.count >= PUBLIC_SUBMISSION_MAX) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a minute before trying again.'
    });
  }
  rec.count += 1;
  next();
};

// Feature A: AI Shopping Assistant Chat Endpoint
const assistantChatSchema = z.object({
  message: z.string().min(1).max(1500),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000)
      })
    )
    .optional(),
  lang: z.enum(['ar', 'en']).default('ar'),
  conversationId: z.string().optional(),
  sessionId: z.string().optional(),
  page: z.string().optional(),
  context: z.string().optional()
});

app.post('/api/assistant/chat', publicSubmissionRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = assistantChatSchema.parse(req.body);
    const response = await processAssistantTurn({
      message: parsed.message,
      history: parsed.history,
      lang: parsed.lang,
      conversationId: parsed.conversationId,
      sessionId: parsed.sessionId,
      page: parsed.page,
      context: parsed.context
    });
    return res.json({ response });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid chat message payload.' });
    }
    console.error('POST /api/assistant/chat error:', err);
    return res.status(500).json({ error: 'Assistant service temporarily unavailable.' });
  }
});

// Feature B: Custom Automation Requests (Public Submission + Admin Management)
const customRequestCreateSchema = z.object({
  name: z.string().max(150).optional(),
  email: z.string().email(),
  whatsapp_number: z.string().max(40).optional(),
  business_type: z.string().min(2).max(200),
  business_problem: z.string().min(5).max(3000),
  desired_outcome: z.string().min(3).max(3000),
  current_tools: z.array(z.string().max(100)).optional(),
  expected_features: z.string().max(2000).optional(),
  budget_range: z.string().max(150).optional(),
  delivery_timeframe: z.string().max(150).optional(),
  additional_notes: z.string().max(2000).optional(),
  marketing_consent: z.boolean(),
  lang: z.enum(['ar', 'en']).optional()
});

app.post('/api/custom-requests', publicSubmissionRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = customRequestCreateSchema.parse(req.body);
    const result = await createCustomAutomationRequest(parsed);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    // Strip internal admin fields from public response
    const publicSafeRequest = result.request
      ? {
          id: result.request.id,
          status: result.request.status,
          created_at: result.request.created_at
        }
      : undefined;
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      message: result.message,
      request: publicSafeRequest
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid form fields.' });
    }
    return res.status(500).json({ error: 'Failed to submit custom automation request.' });
  }
});

app.get('/api/admin/custom-requests', adminRateLimiter, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const requests = await listCustomAutomationRequests();
    return res.json({ requests });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to load custom automation requests.' });
  }
});

const customRequestUpdateSchema = z.object({
  status: z
    .enum([
      'new',
      'reviewing',
      'needs_clarification',
      'quoted',
      'accepted',
      'rejected',
      'completed'
    ])
    .optional(),
  admin_notes: z.string().max(4000).optional(),
  estimated_quote_egp: z.number().min(0).nullable().optional()
});

app.put('/api/admin/custom-requests/:id', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const parsed = customRequestUpdateSchema.parse(req.body);
    const result = await updateCustomAutomationRequest(id, parsed);
    if (!result.success) {
      return res.status(404).json({ error: result.message || 'Request not found.' });
    }
    return res.json({ success: true, request: result.request });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update payload.' });
    }
    return res.status(500).json({ error: 'Failed to update custom request.' });
  }
});

// Feature C: Customer Product Suggestions & Demand Analytics
const productSuggestionCreateSchema = z.object({
  proposed_name: z.string().min(2).max(200),
  problem_solved: z.string().min(5).max(3000),
  target_audience: z.string().min(2).max(300),
  expected_features: z.string().max(2000).optional(),
  platforms_integrations: z.array(z.string().max(100)).optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp_number: z.string().max(40).optional(),
  purchase_likelihood: z.enum(['very_likely', 'likely', 'not_sure', 'unlikely']),
  preferred_price_range: z.string().max(150).optional(),
  additional_context: z.string().max(2000).optional(),
  contact_consent: z.boolean(),
  lang: z.enum(['ar', 'en']).optional()
});

app.post('/api/product-suggestions', publicSubmissionRateLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = productSuggestionCreateSchema.parse(req.body);
    const result = await createProductSuggestion(parsed);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    const publicSafeSuggestion = result.suggestion
      ? {
          id: result.suggestion.id,
          proposed_name: result.suggestion.proposed_name,
          status: result.suggestion.status,
          created_at: result.suggestion.created_at
        }
      : undefined;
    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      duplicate: result.duplicate,
      message: result.message,
      suggestion: publicSafeSuggestion
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || 'Invalid suggestion fields.' });
    }
    return res.status(500).json({ error: 'Failed to submit product suggestion.' });
  }
});

app.get('/api/admin/product-suggestions', adminRateLimiter, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const suggestions = await listProductSuggestions();
    const analytics = computeDemandAnalytics(suggestions);
    return res.json({ suggestions, analytics });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch product suggestions and demand analytics.' });
  }
});

const productSuggestionUpdateSchema = z.object({
  status: z.enum(['under_review', 'planned', 'converted_coming_soon', 'rejected']).optional(),
  admin_notes: z.string().max(4000).optional(),
  converted_product_id: z.string().nullable().optional()
});

app.put('/api/admin/product-suggestions/:id', adminRateLimiter, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const parsed = productSuggestionUpdateSchema.parse(req.body);
    const result = await updateProductSuggestion(id, parsed);
    if (!result.success) {
      return res.status(404).json({ error: result.message || 'Suggestion not found.' });
    }
    return res.json({ success: true, suggestion: result.suggestion });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid suggestion update payload.' });
    }
    return res.status(500).json({ error: 'Failed to update product suggestion.' });
  }
});

// 4. SEO: SITEMAP & ROBOTS.TXT

app.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const products = await fetchProducts({ publishedOnly: true });
    const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://enginity-store-s8dx.vercel.app';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${siteUrl}/ar</loc>
    <xhtml:link rel="alternate" hreflang="ar" href="${siteUrl}/ar" />
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/en" />
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${siteUrl}/en</loc>
    <xhtml:link rel="alternate" hreflang="ar" href="${siteUrl}/ar" />
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/en" />
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

    products.forEach(p => {
      xml += `
  <url>
    <loc>${siteUrl}/ar/products/${p.slug}</loc>
    <xhtml:link rel="alternate" hreflang="ar" href="${siteUrl}/ar/products/${p.slug}" />
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/en/products/${p.slug}" />
    <lastmod>${p.updated_at || p.created_at || new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    xml += '\n</urlset>';

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch {
    res.status(500).send('Error generating sitemap.');
  }
});

app.get('/robots.txt', (req: Request, res: Response) => {
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || 'https://enginity-store-s8dx.vercel.app';
  const txt = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin/

Sitemap: ${siteUrl}/sitemap.xml`;

  res.header('Content-Type', 'text/plain');
  res.send(txt);
});

// 5. VITE INTEGRATION FOR APP SPA ROUTING WITH SSR HEAD METADATA INJECTION
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  // Catch-all route for HTML head SEO tag injection
  app.get('*', async (req: Request, res: Response, next: NextFunction) => {
    const url = req.originalUrl;
    try {
      let indexHtml = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      indexHtml = await vite.transformIndexHtml(url, indexHtml);

      // Handle product details SEO injection
      const productMatch = url.match(/^\/(ar|en)\/products\/([^\/]+)$/);
      if (productMatch) {
        const lang = productMatch[1];
        const slug = productMatch[2];
        const product = await fetchProductBySlug(slug, true);

        if (product) {
          const title = lang === 'ar' ? `${product.name_ar} | Enginity` : `${product.name_en} | Enginity`;
          const desc = lang === 'ar' ? product.short_ar : product.short_en;
          const ogImage = product.cover_path || product.diagram_path || '';

          indexHtml = indexHtml
            .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
            .replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${desc}" />`)
            .replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`)
            .replace(/<meta property="og:description" content=".*?" \/>/, `<meta property="og:description" content="${desc}" />`);

          if (ogImage) {
            indexHtml = indexHtml.replace('</head>', `<meta property="og:image" content="${ogImage}" /></head>`);
          }
        }
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(indexHtml);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Enginity Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
