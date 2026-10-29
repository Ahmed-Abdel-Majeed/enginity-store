import {
  CustomAutomationRequest,
  CustomRequestStatus,
  DemandAnalyticsSummary,
  DemandIdeaGroup,
  Lang,
  ProductSuggestion,
  ProductSuggestionStatus,
  PurchaseLikelihood
} from '../types';
import { getSystemAdminSupabase } from './supabase';
import { normalizePhoneNumber } from './utils';

const PRIVATE_CRM_BUCKET = 'private-crm';
const CUSTOM_REQUESTS_FILE = 'custom_requests.json';
const PRODUCT_SUGGESTIONS_FILE = 'product_suggestions.json';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function computeSimpleHash(input: string): string {
  let hash = 5381;
  const clean = input.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) + hash) + clean.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

const memoryStoreCache = new Map<string, any[]>();

async function ensurePrivateBucket(adminSb: any): Promise<void> {
  try {
    await adminSb.storage.createBucket(PRIVATE_CRM_BUCKET, { public: false });
  } catch {
    // Bucket already exists or handled
  }
}

async function readPrivateJsonList<T extends { id?: string }>(
  adminSb: any,
  fileName: string
): Promise<T[]> {
  const cached = (memoryStoreCache.get(fileName) as T[] | undefined) || [];
  try {
    const { data, error } = await adminSb.storage.from(PRIVATE_CRM_BUCKET).download(fileName);
    if (error || !data) return [...cached];
    const text = await data.text();
    if (!text) return [...cached];
    const parsed = JSON.parse(text);
    const remoteList: T[] = Array.isArray(parsed) ? parsed : [];

    // Merge cached (newest in-memory updates) with remoteList by id
    const byId = new Map<string, T>();
    for (const item of remoteList) {
      if (item && item.id) byId.set(item.id, item);
    }
    for (const item of cached) {
      if (item && item.id) byId.set(item.id, item);
    }
    const merged = Array.from(byId.values());
    memoryStoreCache.set(fileName, merged);
    return merged;
  } catch {
    return [...cached];
  }
}

async function writePrivateJsonList<T extends { id?: string }>(
  adminSb: any,
  fileName: string,
  list: T[]
): Promise<boolean> {
  memoryStoreCache.set(fileName, [...list]);
  try {
    await ensurePrivateBucket(adminSb);
    const payload = JSON.stringify(list, null, 2);
    const body =
      typeof Blob !== 'undefined'
        ? new Blob([payload], { type: 'application/json' })
        : payload;
    const { error } = await adminSb.storage.from(PRIVATE_CRM_BUCKET).upload(fileName, body, {
      upsert: true,
      contentType: 'application/json',
      cacheControl: '0'
    });
    return !error;
  } catch (err) {
    console.error(`Failed writing ${fileName} to private storage:`, err);
    return false;
  }
}

// ============================================================================
// FEATURE B: CUSTOM AUTOMATION REQUESTS
// ============================================================================

export interface SubmitCustomRequestInput {
  name?: string;
  email: string;
  whatsapp_number?: string;
  business_type: string;
  business_problem: string;
  desired_outcome: string;
  current_tools?: string[] | string;
  expected_features?: string;
  budget_range?: string;
  delivery_timeframe?: string;
  additional_notes?: string;
  marketing_consent?: boolean;
  lang?: Lang;
}

export async function createCustomAutomationRequest(
  input: SubmitCustomRequestInput
): Promise<{
  success: boolean;
  duplicate?: boolean;
  request?: CustomAutomationRequest;
  message: string;
}> {
  const lang: Lang = input.lang === 'en' ? 'en' : 'ar';
  const email = (input.email || '').trim().toLowerCase();
  const businessType = (input.business_type || '').trim();
  const businessProblem = (input.business_problem || '').trim();
  const desiredOutcome = (input.desired_outcome || '').trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح للتواصل.' : 'Please enter a valid email address.'
    };
  }

  if (!businessType || businessProblem.length < 10 || desiredOutcome.length < 5) {
    return {
      success: false,
      message:
        lang === 'ar'
          ? 'يرجى توضيح مجال العمل، المشكلة الحالية، والنتيجة المطلوبة بشكل كافٍ لتقييم النظام.'
          : 'Please describe your business type, current problem, and desired outcome clearly.'
    };
  }

  if (input.marketing_consent === false) {
    return {
      success: false,
      message:
        lang === 'ar'
          ? 'يرجى الموافقة على التواصل معك لمناقشة تفاصيل طلبك.'
          : 'Please consent to being contacted regarding your custom automation request.'
    };
  }

  const normalizedWhatsapp = input.whatsapp_number?.trim()
    ? normalizePhoneNumber(input.whatsapp_number.trim())
    : '';

  const toolsArray: string[] = Array.isArray(input.current_tools)
    ? input.current_tools.map(t => String(t).trim()).filter(Boolean)
    : typeof input.current_tools === 'string'
    ? input.current_tools
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];

  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) {
    return {
      success: false,
      message: lang === 'ar' ? 'خدمة قاعدة البيانات غير متاحة حالياً.' : 'Database service unavailable.'
    };
  }

  const nowIso = new Date().toISOString();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Tier 1: Try native PostgreSQL table `custom_automation_requests`
  const { data: existingSql, error: sqlCheckErr } = await adminSb
    .from('custom_automation_requests')
    .select('*')
    .eq('email', email)
    .gte('created_at', tenMinutesAgo);

  if (!sqlCheckErr) {
    const duplicateRow = (existingSql || []).find(
      (r: any) =>
        (r.business_problem || '').trim().toLowerCase() === businessProblem.toLowerCase()
    );

    if (duplicateRow) {
      return {
        success: true,
        duplicate: true,
        request: duplicateRow as CustomAutomationRequest,
        message:
          lang === 'ar'
            ? 'تم استلام طلبك بالفعل وهو قيد المراجعة الفنية لدى فريق ENGINITY.'
            : 'Your request has already been received and is being reviewed by the ENGINITY team.'
      };
    }

    const newRecord = {
      name: (input.name || '').trim(),
      email,
      whatsapp_number: normalizedWhatsapp,
      business_type: businessType,
      business_problem: businessProblem,
      desired_outcome: desiredOutcome,
      current_tools: toolsArray,
      expected_features: (input.expected_features || '').trim(),
      budget_range: (input.budget_range || '').trim(),
      delivery_timeframe: (input.delivery_timeframe || '').trim(),
      additional_notes: (input.additional_notes || '').trim(),
      marketing_consent: Boolean(input.marketing_consent),
      status: 'new' as CustomRequestStatus,
      estimated_quote_egp: null,
      admin_notes: '',
      notification_sent: false
    };

    const { data: inserted, error: insertErr } = await adminSb
      .from('custom_automation_requests')
      .insert(newRecord)
      .select('*')
      .single();

    if (!insertErr && inserted) {
      await dispatchCustomRequestNotification(adminSb, inserted as CustomAutomationRequest, 'sql');
      return {
        success: true,
        duplicate: false,
        request: inserted as CustomAutomationRequest,
        message:
          lang === 'ar'
            ? 'تم استلام طلب الأتمتة المخصصة بنجاح! سيقوم فريقنا الهندسي بدراسة متطلباتك والتواصل معك قريباً.'
            : 'Your custom automation request has been received! Our engineering team will review your requirements and contact you shortly.'
      };
    }
  }

  // Tier 2: Private RLS-protected Supabase Storage fallback (`private-crm/custom_requests.json`)
  const list = await readPrivateJsonList<CustomAutomationRequest>(adminSb, CUSTOM_REQUESTS_FILE);
  const existingItem = list.find(
    item =>
      item.email === email &&
      item.business_problem.trim().toLowerCase() === businessProblem.toLowerCase() &&
      item.created_at >= tenMinutesAgo
  );

  if (existingItem) {
    return {
      success: true,
      duplicate: true,
      request: existingItem,
      message:
        lang === 'ar'
          ? 'تم استلام طلبك بالفعل وهو قيد المراجعة الفنية لدى فريق ENGINITY.'
          : 'Your request has already been received and is being reviewed by the ENGINITY team.'
    };
  }

  const record: CustomAutomationRequest = {
    id: generateUuid(),
    name: (input.name || '').trim(),
    email,
    whatsapp_number: normalizedWhatsapp,
    business_type: businessType,
    business_problem: businessProblem,
    desired_outcome: desiredOutcome,
    current_tools: toolsArray,
    expected_features: (input.expected_features || '').trim(),
    budget_range: (input.budget_range || '').trim(),
    delivery_timeframe: (input.delivery_timeframe || '').trim(),
    additional_notes: (input.additional_notes || '').trim(),
    marketing_consent: Boolean(input.marketing_consent),
    status: 'new',
    estimated_quote_egp: null,
    admin_notes: '',
    notification_sent: false,
    created_at: nowIso,
    updated_at: nowIso
  };

  list.unshift(record);
  const saved = await writePrivateJsonList(adminSb, CUSTOM_REQUESTS_FILE, list);
  if (!saved) {
    return {
      success: false,
      message: lang === 'ar' ? 'تعذّر حفظ الطلب. يرجى المحاولة مرة أخرى.' : 'Failed to save custom request.'
    };
  }

  await dispatchCustomRequestNotification(adminSb, record, 'storage', list);

  return {
    success: true,
    duplicate: false,
    request: record,
    message:
      lang === 'ar'
        ? 'تم استلام طلب الأتمتة المخصصة بنجاح! سيقوم فريقنا الهندسي بدراسة متطلباتك والتواصل معك قريباً.'
        : 'Your custom automation request has been received! Our engineering team will review your requirements and contact you shortly.'
  };
}

async function dispatchCustomRequestNotification(
  adminSb: any,
  request: CustomAutomationRequest,
  tier: 'sql' | 'storage',
  storageList?: CustomAutomationRequest[]
): Promise<void> {
  if (request.notification_sent) return;

  try {
    let webhookUrl = process.env.N8N_CUSTOM_REQUEST_WEBHOOK_URL || '';
    if (!webhookUrl) {
      const { data: settings } = await adminSb.from('settings').select('*').eq('id', 1).maybeSingle();
      webhookUrl = settings?.social_links?.n8n_custom_request_webhook_url || '';
    }

    let notified = false;
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'custom_automation_requested',
          timestamp: new Date().toISOString(),
          request: {
            id: request.id,
            name: request.name,
            email: request.email,
            whatsapp_number: request.whatsapp_number,
            business_type: request.business_type,
            business_problem: request.business_problem,
            desired_outcome: request.desired_outcome,
            current_tools: request.current_tools,
            budget_range: request.budget_range,
            delivery_timeframe: request.delivery_timeframe
          }
        })
      });
      if (res.ok) notified = true;
    }

    if (notified) {
      request.notification_sent = true;
      if (tier === 'sql') {
        await adminSb
          .from('custom_automation_requests')
          .update({ notification_sent: true })
          .eq('id', request.id);
      } else if (storageList) {
        await writePrivateJsonList(adminSb, CUSTOM_REQUESTS_FILE, storageList);
      }
    }
  } catch {
    // Non-blocking notification attempt
  }
}

export async function listCustomAutomationRequests(): Promise<CustomAutomationRequest[]> {
  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) return [];

  const { data, error } = await adminSb
    .from('custom_automation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    return data as CustomAutomationRequest[];
  }

  return await readPrivateJsonList<CustomAutomationRequest>(adminSb, CUSTOM_REQUESTS_FILE);
}

export async function updateCustomAutomationRequest(
  id: string,
  updates: {
    status?: CustomRequestStatus;
    admin_notes?: string;
    estimated_quote_egp?: number | null;
  }
): Promise<{ success: boolean; request?: CustomAutomationRequest; message?: string }> {
  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) {
    return { success: false, message: 'Database service unavailable.' };
  }

  const nowIso = new Date().toISOString();
  const payload: any = { updated_at: nowIso };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.admin_notes !== undefined) payload.admin_notes = updates.admin_notes;
  if (updates.estimated_quote_egp !== undefined) payload.estimated_quote_egp = updates.estimated_quote_egp;

  const { data, error } = await adminSb
    .from('custom_automation_requests')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (!error && data) {
    return { success: true, request: data as CustomAutomationRequest };
  }

  const list = await readPrivateJsonList<CustomAutomationRequest>(adminSb, CUSTOM_REQUESTS_FILE);
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) {
    return { success: false, message: 'Request not found.' };
  }

  list[idx] = {
    ...list[idx],
    ...payload
  };

  const ok = await writePrivateJsonList(adminSb, CUSTOM_REQUESTS_FILE, list);
  return ok
    ? { success: true, request: list[idx] }
    : { success: false, message: 'Failed to persist updated request.' };
}

// ============================================================================
// FEATURE C: PRODUCT SUGGESTIONS & DEMAND VALIDATION
// ============================================================================

export interface SubmitProductSuggestionInput {
  proposed_name: string;
  problem_solved: string;
  target_audience: string;
  expected_features?: string;
  platforms_integrations?: string[] | string;
  email?: string;
  whatsapp_number?: string;
  purchase_likelihood: PurchaseLikelihood;
  preferred_price_range?: string;
  additional_context?: string;
  contact_consent?: boolean;
  lang?: Lang;
}

export async function createProductSuggestion(
  input: SubmitProductSuggestionInput
): Promise<{
  success: boolean;
  duplicate?: boolean;
  suggestion?: ProductSuggestion;
  message: string;
}> {
  const lang: Lang = input.lang === 'en' ? 'en' : 'ar';
  const proposedName = (input.proposed_name || '').trim();
  const problemSolved = (input.problem_solved || '').trim();
  const targetAudience = (input.target_audience || '').trim();
  const validLikelihoods: PurchaseLikelihood[] = ['very_likely', 'likely', 'not_sure', 'unlikely'];

  if (
    proposedName.length < 3 ||
    problemSolved.length < 8 ||
    targetAudience.length < 2 ||
    !validLikelihoods.includes(input.purchase_likelihood)
  ) {
    return {
      success: false,
      message:
        lang === 'ar'
          ? 'يرجى إدخال اسم المنتج المقترح، المشكلة التي يحلها، الفئة المستهدفة، ومدى احتمالية الشراء.'
          : 'Please provide the proposed product name, problem solved, target audience, and purchase likelihood.'
    };
  }

  const email = (input.email || '').trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: lang === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please enter a valid email address.'
    };
  }

  const normalizedWhatsapp = input.whatsapp_number?.trim()
    ? normalizePhoneNumber(input.whatsapp_number.trim())
    : '';

  if (!email && !normalizedWhatsapp) {
    return {
      success: false,
      message:
        lang === 'ar'
          ? 'يرجى إدخال البريد الإلكتروني أو رقم الواتساب للتواصل عند توفير المنتج.'
          : 'Please provide an email address or WhatsApp number.'
    };
  }

  if (!input.contact_consent) {
    return {
      success: false,
      message:
        lang === 'ar'
          ? 'يرجى الموافقة على إشعارك عند إطلاق هذا المنتج.'
          : 'Please consent to receiving launch notifications for this suggestion.'
    };
  }

  const integrationsArray: string[] = Array.isArray(input.platforms_integrations)
    ? input.platforms_integrations.map(t => String(t).trim()).filter(Boolean)
    : typeof input.platforms_integrations === 'string'
    ? input.platforms_integrations
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];

  // Duplicate detection fingerprint: normalized contact (or problem text if anonymous) + normalized idea name
  const contactKey = email || normalizedWhatsapp || problemSolved.slice(0, 40).toLowerCase();
  const fingerprintHash = computeSimpleHash(`${contactKey}::${proposedName.toLowerCase()}`);

  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) {
    return {
      success: false,
      message: lang === 'ar' ? 'خدمة قاعدة البيانات غير متاحة حالياً.' : 'Database service unavailable.'
    };
  }

  const nowIso = new Date().toISOString();

  // Tier 1: Try native PostgreSQL table `product_suggestions`
  const { data: existingSql, error: sqlCheckErr } = await adminSb
    .from('product_suggestions')
    .select('*')
    .eq('fingerprint_hash', fingerprintHash);

  if (!sqlCheckErr) {
    if (existingSql && existingSql.length > 0) {
      return {
        success: true,
        duplicate: true,
        suggestion: existingSql[0] as ProductSuggestion,
        message:
          lang === 'ar'
            ? 'تم تسجيل اقتراحك لهذا المنتج مسبقاً وتم احتساب صوتك في أولويات التطوير.'
            : 'Your suggestion for this product has already been recorded in our development priorities.'
      };
    }

    const newRow = {
      proposed_name: proposedName,
      problem_solved: problemSolved,
      target_audience: targetAudience,
      expected_features: (input.expected_features || '').trim(),
      platforms_integrations: integrationsArray,
      email,
      whatsapp_number: normalizedWhatsapp,
      purchase_likelihood: input.purchase_likelihood,
      preferred_price_range: (input.preferred_price_range || '').trim(),
      additional_context: (input.additional_context || '').trim(),
      contact_consent: Boolean(input.contact_consent),
      fingerprint_hash: fingerprintHash,
      status: 'under_review' as ProductSuggestionStatus,
      converted_product_id: null,
      admin_notes: ''
    };

    const { data: inserted, error: insertErr } = await adminSb
      .from('product_suggestions')
      .insert(newRow)
      .select('*')
      .single();

    if (!insertErr && inserted) {
      return {
        success: true,
        duplicate: false,
        suggestion: inserted as ProductSuggestion,
        message:
          lang === 'ar'
            ? 'شكراً لمشاركتك! تم تسجيل اقتراحك بنجاح لمساعدة فريق ENGINITY في تحديد المنتجات القادمة.'
            : 'Thank you! Your product suggestion has been recorded to help ENGINITY prioritize upcoming workflows.'
      };
    }
  }

  // Tier 2: Private RLS-protected Supabase Storage fallback (`private-crm/product_suggestions.json`)
  const list = await readPrivateJsonList<ProductSuggestion>(adminSb, PRODUCT_SUGGESTIONS_FILE);
  const existingItem = list.find(item => item.fingerprint_hash === fingerprintHash);

  if (existingItem) {
    return {
      success: true,
      duplicate: true,
      suggestion: existingItem,
      message:
        lang === 'ar'
          ? 'تم تسجيل اقتراحك لهذا المنتج مسبقاً وتم احتساب صوتك في أولويات التطوير.'
          : 'Your suggestion for this product has already been recorded in our development priorities.'
    };
  }

  const record: ProductSuggestion = {
    id: generateUuid(),
    proposed_name: proposedName,
    problem_solved: problemSolved,
    target_audience: targetAudience,
    expected_features: (input.expected_features || '').trim(),
    platforms_integrations: integrationsArray,
    email,
    whatsapp_number: normalizedWhatsapp,
    purchase_likelihood: input.purchase_likelihood,
    preferred_price_range: (input.preferred_price_range || '').trim(),
    additional_context: (input.additional_context || '').trim(),
    contact_consent: Boolean(input.contact_consent),
    fingerprint_hash: fingerprintHash,
    status: 'under_review',
    converted_product_id: null,
    admin_notes: '',
    created_at: nowIso,
    updated_at: nowIso
  };

  list.unshift(record);
  const saved = await writePrivateJsonList(adminSb, PRODUCT_SUGGESTIONS_FILE, list);
  if (!saved) {
    return {
      success: false,
      message: lang === 'ar' ? 'تعذّر حفظ الاقتراح. حاول مرة أخرى.' : 'Failed to save product suggestion.'
    };
  }

  return {
    success: true,
    duplicate: false,
    suggestion: record,
    message:
      lang === 'ar'
        ? 'شكراً لمشاركتك! تم تسجيل اقتراحك بنجاح لمساعدة فريق ENGINITY في تحديد المنتجات القادمة.'
        : 'Thank you! Your product suggestion has been recorded to help ENGINITY prioritize upcoming workflows.'
  };
}

export async function listProductSuggestions(): Promise<ProductSuggestion[]> {
  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) return [];

  const { data, error } = await adminSb
    .from('product_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (!error && data) {
    return data as ProductSuggestion[];
  }

  return await readPrivateJsonList<ProductSuggestion>(adminSb, PRODUCT_SUGGESTIONS_FILE);
}

export async function updateProductSuggestion(
  id: string,
  updates: {
    status?: ProductSuggestionStatus;
    admin_notes?: string;
    converted_product_id?: string | null;
  }
): Promise<{ success: boolean; suggestion?: ProductSuggestion; message?: string }> {
  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) {
    return { success: false, message: 'Database service unavailable.' };
  }

  const nowIso = new Date().toISOString();
  const payload: any = { updated_at: nowIso };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.admin_notes !== undefined) payload.admin_notes = updates.admin_notes;
  if (updates.converted_product_id !== undefined) payload.converted_product_id = updates.converted_product_id;

  const { data, error } = await adminSb
    .from('product_suggestions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (!error && data) {
    return { success: true, suggestion: data as ProductSuggestion };
  }

  const list = await readPrivateJsonList<ProductSuggestion>(adminSb, PRODUCT_SUGGESTIONS_FILE);
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) {
    return { success: false, message: 'Suggestion not found.' };
  }

  list[idx] = {
    ...list[idx],
    ...payload
  };

  const ok = await writePrivateJsonList(adminSb, PRODUCT_SUGGESTIONS_FILE, list);
  return ok
    ? { success: true, suggestion: list[idx] }
    : { success: false, message: 'Failed to persist updated suggestion.' };
}

export function computeDemandAnalytics(suggestions: ProductSuggestion[]): DemandAnalyticsSummary {
  const intentDistribution = {
    very_likely: 0,
    likely: 0,
    not_sure: 0,
    unlikely: 0
  };

  const contactSet = new Set<string>();
  const integrationCounts = new Map<string, number>();
  const ideaMap = new Map<
    string,
    {
      display_name: string;
      submissions_count: number;
      contacts: Set<string>;
      high_intent_count: number;
      integrations: Map<string, number>;
      latest_submission_at: string;
      sample_problem: string;
      target_audience: string;
      suggestion_ids: string[];
      status: ProductSuggestionStatus;
    }
  >();

  for (const s of suggestions) {
    if (s.purchase_likelihood in intentDistribution) {
      intentDistribution[s.purchase_likelihood] += 1;
    }

    const contactId =
      (s.email && s.email.trim().toLowerCase()) ||
      (s.whatsapp_number && s.whatsapp_number.trim()) ||
      `anon_${s.id}`;
    contactSet.add(contactId);

    for (const rawTool of s.platforms_integrations || []) {
      const cleanTool = rawTool.trim();
      if (!cleanTool) continue;
      integrationCounts.set(cleanTool, (integrationCounts.get(cleanTool) || 0) + 1);
    }

    const normalizedKey = s.proposed_name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ');

    const isHighIntent = s.purchase_likelihood === 'very_likely' || s.purchase_likelihood === 'likely';

    const existingGroup = ideaMap.get(normalizedKey);
    if (!existingGroup) {
      const toolMap = new Map<string, number>();
      for (const t of s.platforms_integrations || []) {
        if (t.trim()) toolMap.set(t.trim(), 1);
      }
      ideaMap.set(normalizedKey, {
        display_name: s.proposed_name.trim(),
        submissions_count: 1,
        contacts: new Set([contactId]),
        high_intent_count: isHighIntent ? 1 : 0,
        integrations: toolMap,
        latest_submission_at: s.created_at,
        sample_problem: s.problem_solved,
        target_audience: s.target_audience,
        suggestion_ids: [s.id],
        status: s.status
      });
    } else {
      existingGroup.submissions_count += 1;
      existingGroup.contacts.add(contactId);
      if (isHighIntent) existingGroup.high_intent_count += 1;
      for (const t of s.platforms_integrations || []) {
        if (t.trim()) {
          existingGroup.integrations.set(t.trim(), (existingGroup.integrations.get(t.trim()) || 0) + 1);
        }
      }
      if (s.created_at > existingGroup.latest_submission_at) {
        existingGroup.latest_submission_at = s.created_at;
      }
      existingGroup.suggestion_ids.push(s.id);
    }
  }

  const topIntegrations = Array.from(integrationCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topIdeas: DemandIdeaGroup[] = Array.from(ideaMap.entries())
    .map(([normalized_title, group]) => ({
      normalized_title,
      display_name: group.display_name,
      submissions_count: group.submissions_count,
      distinct_contacts_count: group.contacts.size,
      high_intent_count: group.high_intent_count,
      top_integrations: Array.from(group.integrations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(e => e[0]),
      latest_submission_at: group.latest_submission_at,
      sample_problem: group.sample_problem,
      target_audience: group.target_audience,
      suggestion_ids: group.suggestion_ids,
      status: group.status
    }))
    .sort((a, b) => {
      if (b.high_intent_count !== a.high_intent_count) return b.high_intent_count - a.high_intent_count;
      return b.submissions_count - a.submissions_count;
    });

  return {
    total_submissions: suggestions.length,
    distinct_contacts: contactSet.size,
    intent_distribution: intentDistribution,
    top_integrations: topIntegrations,
    top_ideas: topIdeas
  };
}

export async function cleanupSyntheticTestRecords(): Promise<void> {
  const adminSb = await getSystemAdminSupabase();
  if (!adminSb) return;

  // Clean SQL tables if present
  try {
    await adminSb
      .from('custom_automation_requests')
      .delete()
      .ilike('email', '%@enginity.test');
    await adminSb
      .from('product_suggestions')
      .delete()
      .ilike('email', '%@enginity.test');
  } catch {
    // Ignore if SQL tables not created yet
  }

  // Clean storage fallback files
  const reqs = await readPrivateJsonList<CustomAutomationRequest>(adminSb, CUSTOM_REQUESTS_FILE);
  const cleanedReqs = reqs.filter(r => !r.email.endsWith('@enginity.test'));
  await writePrivateJsonList(adminSb, CUSTOM_REQUESTS_FILE, cleanedReqs);

  const sugs = await readPrivateJsonList<ProductSuggestion>(adminSb, PRODUCT_SUGGESTIONS_FILE);
  const cleanedSugs = sugs.filter(s => !(s.email && s.email.endsWith('@enginity.test')));
  await writePrivateJsonList(adminSb, PRODUCT_SUGGESTIONS_FILE, cleanedSugs);
}

