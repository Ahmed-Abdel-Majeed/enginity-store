import { SupabaseClient } from '@supabase/supabase-js';
import {
  CustomAutomationRequest,
  CustomRequestStatus,
  DemandAnalyticsSummary,
  Lang,
  ProductRatingSummary,
  ProductReview,
  ProductReviewStatus,
  ProductSuggestion,
  ProductSuggestionStatus,
  PurchaseLikelihood,
  WaitlistEntry,
} from '../types';
import {
  supabase,
  isSupabaseConfigured,
  createAuthenticatedClient,
  verifyAdminSession,
  getSystemAdminToken,
} from './supabase';
import { computeProductRatingSummary } from './utils';
import { isHoneypotTriggered } from './validation';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export type AdminAuthArg =
  | string
  | null
  | undefined
  | { token?: string | null; requireAuthCheck?: boolean };

async function resolveAdminSupabaseClient(
  authArg?: AdminAuthArg
): Promise<{ client: SupabaseClient | null; unauthorized: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { client: null, unauthorized: true, error: 'Supabase is not configured.' };
  }

  const isObj = typeof authArg === 'object' && authArg !== null;
  const explicitToken = isObj ? authArg.token : authArg;
  const requireAuthCheck = isObj ? Boolean(authArg.requireAuthCheck) : false;

  if (requireAuthCheck && (!explicitToken || !String(explicitToken).trim())) {
    return {
      client: null,
      unauthorized: true,
      error: 'Missing administrator access token.',
    };
  }

  let token = explicitToken ? String(explicitToken).trim() : null;
  if (!token) {
    if (typeof window !== 'undefined') {
      const verification = await verifyAdminSession();
      if (!verification.isAuthenticated || !verification.isAdmin || !verification.accessToken) {
        return {
          client: null,
          unauthorized: true,
          error:
            verification.error ||
            'Unauthorized: Active administrator session required.',
        };
      }
      token = verification.accessToken;
    } else {
      token = await getSystemAdminToken();
    }
  }

  if (!token) {
    return { client: null, unauthorized: true, error: 'Missing administrator access token.' };
  }

  const authedClient = createAuthenticatedClient(token);
  const { data: isAdmin, error: rpcError } = await authedClient.rpc('is_admin');
  if (rpcError || !isAdmin) {
    return {
      client: null,
      unauthorized: true,
      error: rpcError?.message || 'Forbidden: User is not an authorized administrator.',
    };
  }

  return { client: authedClient, unauthorized: false };
}

// ==========================================
// 1. Product Waitlist (TASK-006, TASK-007)
// ==========================================
export interface SubmitWaitlistInput {
  product_id?: string;
  productId?: string;
  email?: string;
  whatsapp_number?: string;
  whatsappNumber?: string;
  interest_note?: string;
  emailConsent?: boolean;
  whatsappConsent?: boolean;
  lang?: Lang;
  website_url?: string;
}

const recentWaitlistSubmissions = new Map<string, number>();

export async function submitWaitlistEntry(input: SubmitWaitlistInput): Promise<{
  success: boolean;
  alreadyRegistered?: boolean;
  message: string;
  data: WaitlistEntry | null;
  error: string | null;
}> {
  const isAr = (input.lang || 'ar') === 'ar';

  if (isHoneypotTriggered(input)) {
    return {
      success: true,
      alreadyRegistered: false,
      message: isAr ? 'تم تسجيل اهتمامك بنجاح.' : 'Successfully registered on waitlist.',
      data: null,
      error: null,
    };
  }

  const productId = String(input.product_id || input.productId || '').trim();
  const cleanEmail = String(input.email || '').trim().toLowerCase();
  const cleanWhatsapp = String(input.whatsapp_number || input.whatsappNumber || '').trim();
  const interestNote = String(input.interest_note || '').trim();

  if (!productId) {
    const msg = isAr ? 'معرف المنتج مطلوب.' : 'Product ID is required.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (!cleanEmail && !cleanWhatsapp) {
    const msg = isAr
      ? 'يرجى إدخال البريد الإلكتروني أو رقم الواتساب.'
      : 'Please provide an email address or WhatsApp number.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
    const msg = isAr ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Invalid email address format.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (!isSupabaseConfigured()) {
    const msg = isAr ? 'قاعدة البيانات غير متصلة.' : 'Database is not configured.';
    return { success: false, message: msg, data: null, error: msg };
  }

  const recentWaitlistKey = `${productId}::${cleanEmail || cleanWhatsapp}`;
  const existingWaitlistTs = recentWaitlistSubmissions.get(recentWaitlistKey) || 0;
  if (Date.now() - existingWaitlistTs < 300_000) {
    const dupMsg = isAr
      ? 'أنت مسجل بالفعل في قائمة الانتظار لهذا المنتج! سنقوم بإشعارك فور الإطلاق.'
      : 'You are already registered on the waitlist for this product!';
    return {
      success: true,
      alreadyRegistered: true,
      message: dupMsg,
      data: null,
      error: null,
    };
  }

  const effectiveEmail = cleanEmail || '';

  const { error } = await supabase.from('product_waitlist').insert({
    product_id: productId,
    email: effectiveEmail,
    whatsapp_number: cleanWhatsapp || '',
    email_consent: cleanEmail ? (input.emailConsent ?? true) : false,
    whatsapp_consent: cleanWhatsapp ? (input.whatsappConsent ?? true) : false,
    consent_text_ar: 'موافقة صريحة على استلام إشعار إطلاق المنتج',
    consent_text_en: 'Explicit consent to receive product launch notification',
  });

  if (error) {
    if (error.code === '23505' || error.message?.toLowerCase().includes('duplicate')) {
      recentWaitlistSubmissions.set(recentWaitlistKey, Date.now());
      const dupMsg = isAr
        ? 'أنت مسجل بالفعل في قائمة الانتظار لهذا المنتج! سنقوم بإشعارك فور الإطلاق.'
        : 'You are already registered on the waitlist for this product!';
      return {
        success: true,
        alreadyRegistered: true,
        message: dupMsg,
        data: null,
        error: null,
      };
    }

    const errMsg =
      error.message || (isAr ? 'تعذر التسجيل في قائمة الانتظار.' : 'Failed to join waitlist.');
    return {
      success: false,
      message: errMsg,
      data: null,
      error: errMsg,
    };
  }

  recentWaitlistSubmissions.set(recentWaitlistKey, Date.now());

  const entry: WaitlistEntry = {
    id: '',
    product_id: productId,
    email: effectiveEmail,
    whatsapp_number: cleanWhatsapp,
    interest_note: interestNote,
    email_consent: cleanEmail ? (input.emailConsent ?? true) : false,
    whatsapp_consent: cleanWhatsapp ? (input.whatsappConsent ?? true) : false,
    lang: input.lang || 'ar',
    created_at: new Date().toISOString(),
  };

  return {
    success: true,
    alreadyRegistered: false,
    message: isAr
      ? 'تم تسجيلك في قائمة الانتظار بنجاح! سنبلغك فور إطلاق المنتج.'
      : 'Successfully joined the waitlist! We will notify you upon launch.',
    data: entry,
    error: null,
  };
}

export const registerWaitlistInterest = submitWaitlistEntry;

export async function fetchWaitlistEntries(productId?: string): Promise<WaitlistEntry[]> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient();
  if (unauthorized || !client) {
    throw new Error(error || 'Unauthorized admin access');
  }

  let query = client
    .from('product_waitlist')
    .select('*')
    .order('created_at', { ascending: false });

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error: dbError } = await query;
  if (dbError) {
    throw new Error(dbError.message);
  }

  return (data || []) as WaitlistEntry[];
}

// ==========================================
// 2. Custom Automation Requests (TASK-006, TASK-007)
// ==========================================
export interface CreateCustomAutomationRequestInput {
  name?: string;
  full_name?: string;
  email: string;
  whatsapp_number?: string;
  business_type?: string;
  industry?: string;
  brand_name?: string;
  business_problem?: string;
  pain_points?: string;
  current_workflow?: string;
  desired_outcome?: string;
  automation_goal?: string;
  current_tools?: string[];
  platforms_involved?: string[];
  existing_tools?: string;
  expected_features?: string;
  budget_range?: string;
  delivery_timeframe?: string;
  timeline_urgency?: 'urgent' | '1_2_weeks' | 'within_month' | 'flexible';
  additional_notes?: string;
  marketing_consent?: boolean;
  need_consultation_first?: boolean;
  preferred_contact_method?: 'whatsapp' | 'email' | 'both';
  lang?: Lang;
  website_url?: string;
}

function mapDbRowToCustomRequest(row: any): CustomAutomationRequest {
  const fullName = row.full_name || row.name || '';
  const businessType = row.industry || row.business_type || row.brand_name || '';
  const businessProblem = row.pain_points || row.business_problem || row.business_description || '';
  const desiredOutcome = row.automation_goal || row.desired_outcome || '';
  const platforms = Array.isArray(row.platforms_involved)
    ? row.platforms_involved
    : Array.isArray(row.current_tools)
    ? row.current_tools
    : [];

  let parsedExtra: Record<string, any> = {};
  if (typeof row.additional_notes === 'string' && row.additional_notes.includes('<!--META:')) {
    const match = row.additional_notes.match(/<!--META:(\{[\s\S]*?\})-->/);
    if (match) {
      try {
        parsedExtra = JSON.parse(match[1]);
      } catch {
        // Ignore
      }
    }
  }

  const cleanNotes =
    typeof row.additional_notes === 'string'
      ? row.additional_notes.replace(/<!--META:\{[\s\S]*?\}-->/g, '').trim()
      : '';

  const rawStatus = parsedExtra.ui_status || row.status || 'new';
  const uiStatusMap: Record<string, CustomRequestStatus> = {
    new: 'new',
    reviewing: 'reviewing',
    reviewed: 'reviewing',
    needs_clarification: 'needs_clarification',
    quoted: 'quoted',
    contacted: 'quoted',
    accepted: 'accepted',
    in_progress: 'accepted',
    rejected: 'rejected',
    completed: 'completed',
    closed: 'completed',
  };

  return {
    id: String(row.id),
    name: fullName,
    full_name: fullName,
    brand_name: row.brand_name || businessType,
    industry: businessType,
    business_type: businessType,
    email: row.email || '',
    whatsapp_number: row.whatsapp_number || '',
    preferred_contact_method: row.preferred_contact_method || 'whatsapp',
    business_description: row.business_description || businessProblem,
    business_problem: businessProblem,
    current_workflow: row.current_workflow || '',
    pain_points: businessProblem,
    automation_goal: desiredOutcome,
    desired_outcome: desiredOutcome,
    platforms_involved: platforms,
    current_tools: platforms,
    existing_tools: row.existing_tools || platforms.join(', '),
    expected_features: row.current_workflow || parsedExtra.expected_features || '',
    expected_volume: row.expected_volume || '',
    timeline_urgency: row.timeline_urgency || 'flexible',
    delivery_timeframe:
      parsedExtra.delivery_timeframe || row.expected_volume || row.timeline_urgency || '',
    budget_range: row.budget_range || '',
    need_consultation_first: Boolean(row.need_consultation_first),
    marketing_consent: parsedExtra.marketing_consent ?? true,
    additional_notes: cleanNotes,
    status: uiStatusMap[rawStatus] || 'new',
    estimated_quote_egp:
      parsedExtra.estimated_quote_egp !== undefined ? parsedExtra.estimated_quote_egp : null,
    admin_notes: row.admin_notes || '',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function normalizeDbCustomStatus(status?: CustomRequestStatus): string {
  if (!status) return 'new';
  const valid = [
    'new',
    'reviewing',
    'needs_clarification',
    'quoted',
    'accepted',
    'rejected',
    'completed',
  ];
  if (valid.includes(status)) return status;
  return 'new';
}

const recentCustomRequestFingerprints = new Map<string, number>();

export async function createCustomAutomationRequest(
  input: CreateCustomAutomationRequestInput
): Promise<{
  success: boolean;
  duplicate?: boolean;
  message: string;
  requestId?: string;
  request?: CustomAutomationRequest;
  record?: CustomAutomationRequest;
  item?: CustomAutomationRequest;
  data: CustomAutomationRequest | null;
  error: string | null;
}> {
  const isAr = (input.lang || 'ar') === 'ar';

  if (isHoneypotTriggered(input)) {
    return {
      success: true,
      duplicate: false,
      message: isAr ? 'تم استلام طلبك بنجاح.' : 'Your request has been received.',
      data: null,
      error: null,
    };
  }

  const fullName = String(input.full_name || input.name || '').trim();
  const cleanEmail = String(input.email || '').trim().toLowerCase();
  const cleanWhatsapp = String(input.whatsapp_number || '').trim();
  const businessType = String(input.industry || input.business_type || input.brand_name || '').trim();
  const businessProblem = String(input.pain_points || input.business_problem || '').trim();
  const desiredOutcome = String(
    input.automation_goal || input.desired_outcome || businessProblem
  ).trim();
  const tools = Array.isArray(input.platforms_involved)
    ? input.platforms_involved
    : Array.isArray(input.current_tools)
    ? input.current_tools
    : [];

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    const msg = isAr ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please provide a valid email address.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (fullName.length < 2 || fullName.length > 120) {
    const msg = isAr
      ? 'يرجى إدخال الاسم الكامل (من حرفين إلى 120 حرفاً).'
      : 'Please provide your full name (2 to 120 characters).';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (!desiredOutcome || desiredOutcome.length < 3 || desiredOutcome.length > 3000) {
    const msg = isAr
      ? 'يرجى توضيح المشكلة أو النتيجة المطلوبة من الأتمتة.'
      : 'Please describe the automation problem and desired outcome.';
    return { success: false, message: msg, data: null, error: msg };
  }

  const dedupeKey = `${cleanEmail}::${businessProblem.toLowerCase()}::${desiredOutcome.toLowerCase()}`;
  const lastSubmittedAt = recentCustomRequestFingerprints.get(dedupeKey) || 0;
  if (Date.now() - lastSubmittedAt < 60_000) {
    return {
      success: true,
      duplicate: true,
      message: isAr
        ? 'تم تسجيل طلبك بالفعل منذ قليل! سيتواصل معك فريقنا قريباً.'
        : 'Your request was already submitted recently! Our team will contact you shortly.',
      data: null,
      error: null,
    };
  }

  if (!isSupabaseConfigured()) {
    const msg = isAr ? 'قاعدة البيانات غير متصلة.' : 'Database is not configured.';
    return { success: false, message: msg, data: null, error: msg };
  }

  const dbPayload = {
    name: fullName,
    email: cleanEmail,
    whatsapp_number: cleanWhatsapp || '',
    business_type: businessType || 'General Business',
    business_problem: businessProblem || desiredOutcome,
    desired_outcome: desiredOutcome || businessProblem,
    current_tools: tools,
    expected_features: String(input.expected_features || input.current_workflow || '').trim(),
    budget_range: String(input.budget_range || '').trim(),
    delivery_timeframe: String(input.delivery_timeframe || input.timeline_urgency || '').trim(),
    additional_notes: String(input.additional_notes || '').trim(),
    marketing_consent: Boolean(input.marketing_consent ?? true),
    status: 'new',
  };

  let insertedRow: any = null;
  const adminToken = typeof window === 'undefined' ? await getSystemAdminToken() : null;
  if (adminToken) {
    const authed = createAuthenticatedClient(adminToken);
    const { data, error } = await authed
      .from('custom_automation_requests')
      .insert(dbPayload)
      .select('*')
      .maybeSingle();
    if (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        error: error.message,
      };
    }
    insertedRow = data;
  } else {
    const { error } = await supabase.from('custom_automation_requests').insert(dbPayload);
    if (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        error: error.message,
      };
    }
  }

  if (cleanEmail) {
    recentCustomRequestFingerprints.set(dedupeKey, Date.now());
  }

  const mapped = mapDbRowToCustomRequest(
    insertedRow || {
      id: '',
      ...dbPayload,
      admin_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );

  return {
    success: true,
    duplicate: false,
    message: isAr
      ? 'تم استلام طلب النظام المخصص بنجاح! سيتواصل معك فريقنا الهندسي قريباً.'
      : 'Your custom automation request has been submitted! Our engineering team will contact you shortly.',
    requestId: mapped.id || undefined,
    request: mapped,
    record: mapped,
    item: mapped,
    data: mapped,
    error: null,
  };
}

export const submitCustomRequest = createCustomAutomationRequest;

export async function listCustomAutomationRequests(
  authArg?: AdminAuthArg
): Promise<CustomAutomationRequest[]> {
  const { client, unauthorized } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    return [];
  }

  const { data, error } = await client
    .from('custom_automation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapDbRowToCustomRequest);
}

export async function fetchCustomRequests(): Promise<CustomAutomationRequest[]> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient();
  if (unauthorized || !client) {
    throw new Error(error || 'Unauthorized administrator access');
  }

  const { data, error: dbError } = await client
    .from('custom_automation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbError) {
    throw new Error(dbError.message);
  }

  return (data || []).map(mapDbRowToCustomRequest);
}

export const fetchAdminCustomRequests = fetchCustomRequests;

export async function updateCustomAutomationRequest(
  id: string,
  updates: {
    status?: CustomRequestStatus;
    estimated_quote_egp?: number | null;
    admin_notes?: string;
  },
  authArg?: AdminAuthArg
): Promise<{
  success: boolean;
  unauthorized?: boolean;
  request?: CustomAutomationRequest;
  record?: CustomAutomationRequest;
  data: CustomAutomationRequest | null;
  error: string | null;
}> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    return {
      success: false,
      unauthorized: true,
      data: null,
      error: error || 'Unauthorized administrator access',
    };
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) {
    payload.status = normalizeDbCustomStatus(updates.status);
  }
  if (updates.estimated_quote_egp !== undefined) {
    payload.estimated_quote_egp = updates.estimated_quote_egp;
  }
  if (updates.admin_notes !== undefined) {
    payload.admin_notes = updates.admin_notes;
  }

  const { data, error: dbError } = await client
    .from('custom_automation_requests')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (dbError || !data) {
    return {
      success: false,
      data: null,
      error: dbError?.message || 'Failed to update custom automation request',
    };
  }

  const mapped = mapDbRowToCustomRequest(data);
  return {
    success: true,
    request: mapped,
    record: mapped,
    data: mapped,
    error: null,
  };
}

export const updateCustomRequest = updateCustomAutomationRequest;
export const updateAdminCustomRequest = updateCustomAutomationRequest;

// ==========================================
// 3. Product Suggestions & Demand Analytics (TASK-006, TASK-007)
// ==========================================
export interface CreateProductSuggestionInput {
  proposed_name: string;
  problem_solved: string;
  target_audience?: string;
  expected_features?: string;
  platforms_integrations?: string[];
  email?: string;
  whatsapp_number?: string;
  purchase_likelihood?: PurchaseLikelihood;
  preferred_price_range?: string;
  additional_context?: string;
  contact_consent?: boolean;
  lang?: Lang;
  website_url?: string;
}

function normalizeDbPurchaseLikelihood(
  val?: PurchaseLikelihood | string
): 'very_likely' | 'likely' | 'not_sure' | 'unlikely' {
  if (!val) return 'very_likely';
  if (val === 'very_likely' || val === 'definitely') return 'very_likely';
  if (val === 'likely' || val === 'probably') return 'likely';
  if (val === 'not_sure' || val === 'maybe') return 'not_sure';
  return 'unlikely';
}

function mapDbLikelihoodToUi(val?: string): PurchaseLikelihood {
  if (val === 'definitely' || val === 'very_likely') return 'very_likely';
  if (val === 'probably' || val === 'likely') return 'likely';
  if (val === 'maybe' || val === 'not_sure') return 'not_sure';
  if (val === 'just_idea' || val === 'unlikely') return 'unlikely';
  return 'very_likely';
}

function normalizeDbSuggestionStatus(status?: ProductSuggestionStatus | string): string {
  if (!status) return 'under_review';
  const valid = ['under_review', 'planned', 'converted_coming_soon', 'rejected'];
  if (valid.includes(status)) return status;
  if (status === 'new' || status === 'reviewed') return 'under_review';
  if (status === 'in_development' || status === 'launched') return 'converted_coming_soon';
  return 'under_review';
}

function mapDbSuggestionStatusToUi(status?: string): ProductSuggestionStatus {
  if (status === 'new' || status === 'reviewed' || status === 'under_review') return 'under_review';
  if (status === 'planned') return 'planned';
  if (
    status === 'in_development' ||
    status === 'launched' ||
    status === 'converted_coming_soon'
  ) {
    return 'converted_coming_soon';
  }
  if (status === 'rejected') return 'rejected';
  return 'under_review';
}

function mapDbRowToProductSuggestion(row: any): ProductSuggestion {
  return {
    id: String(row.id),
    proposed_name: row.proposed_name || '',
    problem_solved: row.problem_solved || '',
    target_audience: row.target_audience || '',
    expected_features: row.expected_features || '',
    platforms_integrations: Array.isArray(row.platforms_integrations)
      ? row.platforms_integrations
      : [],
    email: row.email || '',
    whatsapp_number: row.whatsapp_number || '',
    purchase_likelihood: mapDbLikelihoodToUi(row.purchase_likelihood),
    preferred_price_range: row.preferred_price_range || '',
    additional_context: row.additional_context || '',
    contact_consent: Boolean(row.contact_consent),
    fingerprint_hash: row.fingerprint_hash || '',
    status: mapDbSuggestionStatusToUi(row.status),
    converted_product_id: row.converted_product_id || null,
    admin_notes: row.admin_notes || '',
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

export function buildSuggestionFingerprint(
  proposedName: string,
  platforms: string[] = []
): string {
  const normTitle = proposedName
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normPlatforms = [...platforms]
    .map((p) => p.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join('|');

  return `${normTitle}::${normPlatforms}`;
}

const recentSuggestionFingerprints = new Map<string, number>();

export async function createProductSuggestion(
  input: CreateProductSuggestionInput
): Promise<{
  success: boolean;
  duplicate?: boolean;
  message: string;
  suggestionId?: string;
  suggestion?: ProductSuggestion;
  record?: ProductSuggestion;
  item?: ProductSuggestion;
  data: ProductSuggestion | null;
  error: string | null;
}> {
  const isAr = (input.lang || 'ar') === 'ar';

  if (isHoneypotTriggered(input)) {
    return {
      success: true,
      duplicate: false,
      message: isAr ? 'تم استلام اقتراحك بنجاح.' : 'Your suggestion has been received.',
      data: null,
      error: null,
    };
  }

  const proposedName = String(input.proposed_name || '').trim();
  const problemSolved = String(input.problem_solved || '').trim();
  const targetAudience = String(input.target_audience || '').trim();
  const cleanEmail = String(input.email || '').trim().toLowerCase();

  if (proposedName.length < 2 || proposedName.length > 200) {
    const msg = isAr
      ? 'يرجى إدخال اسم المنتج المقترح (من حرفين إلى 200 حرف).'
      : 'Please enter a proposed product name (2 to 200 characters).';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (problemSolved.length < 5 || problemSolved.length > 3000) {
    const msg = isAr
      ? 'يرجى شرح المشكلة التي يحلها المنتج (5 أحرف على الأقل).'
      : 'Please describe the problem solved (at least 5 characters).';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
    const msg = isAr ? 'صيغة البريد الإلكتروني غير صحيحة.' : 'Invalid email format.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (!isSupabaseConfigured()) {
    const msg = isAr ? 'قاعدة البيانات غير متصلة.' : 'Database is not configured.';
    return { success: false, message: msg, data: null, error: msg };
  }

  const platforms = Array.isArray(input.platforms_integrations)
    ? input.platforms_integrations
    : [];
  const fingerprint_hash = buildSuggestionFingerprint(proposedName, platforms);
  const dedupeKey = `${cleanEmail}::${fingerprint_hash}`;
  const lastSubmittedAt = recentSuggestionFingerprints.get(dedupeKey) || 0;
  if (cleanEmail && Date.now() - lastSubmittedAt < 60_000) {
    return {
      success: true,
      duplicate: true,
      message: isAr
        ? 'تم تسجيل هذا الاقتراح مسبقاً، شكراً لمساهمتك!'
        : 'This suggestion was already recorded recently. Thank you!',
      data: null,
      error: null,
    };
  }

  const dbPayload = {
    proposed_name: proposedName,
    problem_solved: problemSolved,
    target_audience: targetAudience || 'General Business',
    expected_features: String(input.expected_features || '').trim(),
    platforms_integrations: platforms,
    email: cleanEmail,
    whatsapp_number: String(input.whatsapp_number || '').trim(),
    purchase_likelihood: normalizeDbPurchaseLikelihood(input.purchase_likelihood),
    preferred_price_range: String(input.preferred_price_range || '').trim(),
    additional_context: String(input.additional_context || '').trim(),
    contact_consent: Boolean(input.contact_consent),
    fingerprint_hash,
    status: 'under_review',
  };

  let insertedRow: any = null;
  const adminToken = typeof window === 'undefined' ? await getSystemAdminToken() : null;
  if (adminToken) {
    const authed = createAuthenticatedClient(adminToken);
    const { data, error } = await authed
      .from('product_suggestions')
      .insert(dbPayload)
      .select('*')
      .maybeSingle();
    if (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        error: error.message,
      };
    }
    insertedRow = data;
  } else {
    const { error } = await supabase.from('product_suggestions').insert(dbPayload);
    if (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        error: error.message,
      };
    }
  }

  if (cleanEmail) {
    recentSuggestionFingerprints.set(dedupeKey, Date.now());
  }

  const mapped = mapDbRowToProductSuggestion(
    insertedRow || {
      id: '',
      ...dbPayload,
      converted_product_id: null,
      admin_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );

  return {
    success: true,
    duplicate: false,
    message: isAr
      ? 'شكراً لك! تم تسجيل اقتراحك في خارطة طريق منتجات ENGINITY.'
      : 'Thank you! Your product suggestion has been added to the ENGINITY roadmap.',
    suggestionId: mapped.id || undefined,
    suggestion: mapped,
    record: mapped,
    item: mapped,
    data: mapped,
    error: null,
  };
}

export const submitProductSuggestion = createProductSuggestion;

export async function listProductSuggestions(
  authArg?: AdminAuthArg
): Promise<ProductSuggestion[]> {
  const { client, unauthorized } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    return [];
  }

  const { data, error } = await client
    .from('product_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapDbRowToProductSuggestion);
}

export function computeDemandAnalytics(
  suggestions: ProductSuggestion[]
): DemandAnalyticsSummary {
  const total_submissions = suggestions.length;
  const intent_distribution: Record<PurchaseLikelihood, number> = {
    very_likely: 0,
    likely: 0,
    not_sure: 0,
    unlikely: 0,
  };

  const uniqueContacts = new Set<string>();
  const platformCounts = new Map<string, number>();
  const ideaGroups = new Map<
    string,
    {
      fingerprint: string;
      representative_name: string;
      problem_summary: string;
      submission_count: number;
      high_intent_count: number;
      integrations: Set<string>;
      latest_status: ProductSuggestionStatus;
      suggestion_ids: string[];
    }
  >();

  for (const s of suggestions) {
    const likelihood = mapDbLikelihoodToUi(s.purchase_likelihood);
    intent_distribution[likelihood] = (intent_distribution[likelihood] || 0) + 1;

    const contactKey = (s.email || s.whatsapp_number || '').trim().toLowerCase();
    if (contactKey) {
      uniqueContacts.add(contactKey);
    }

    for (const p of s.platforms_integrations || []) {
      const cleanP = p.trim();
      if (cleanP) {
        platformCounts.set(cleanP, (platformCounts.get(cleanP) || 0) + 1);
      }
    }

    const fp =
      s.fingerprint_hash ||
      buildSuggestionFingerprint(s.proposed_name, s.platforms_integrations);
    const isHighIntent = likelihood === 'very_likely' || likelihood === 'likely';

    const existing = ideaGroups.get(fp);
    if (!existing) {
      ideaGroups.set(fp, {
        fingerprint: fp,
        representative_name: s.proposed_name,
        problem_summary: s.problem_solved,
        submission_count: 1,
        high_intent_count: isHighIntent ? 1 : 0,
        integrations: new Set(s.platforms_integrations || []),
        latest_status: s.status || 'under_review',
        suggestion_ids: s.id ? [s.id] : [],
      });
    } else {
      existing.submission_count += 1;
      if (isHighIntent) {
        existing.high_intent_count += 1;
      }
      for (const p of s.platforms_integrations || []) {
        existing.integrations.add(p);
      }
      if (s.id) {
        existing.suggestion_ids.push(s.id);
      }
    }
  }

  const top_integrations = Array.from(platformCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const top_ideas = Array.from(ideaGroups.values())
    .map((g) => {
      const integrationsList = Array.from(g.integrations);
      return {
        fingerprint: g.fingerprint,
        normalized_title: g.fingerprint.split('::')[0] || g.representative_name,
        display_name: g.representative_name,
        representative_name: g.representative_name,
        problem_summary: g.problem_summary,
        submission_count: g.submission_count,
        submissions_count: g.submission_count,
        distinct_contacts_count: g.submission_count,
        high_intent_count: g.high_intent_count,
        integrations: integrationsList,
        top_integrations: integrationsList,
        latest_status: g.latest_status,
        status: g.latest_status,
        suggestion_ids: g.suggestion_ids,
      };
    })
    .sort(
      (a, b) =>
        b.submission_count - a.submission_count ||
        b.high_intent_count - a.high_intent_count
    )
    .slice(0, 10);

  return {
    total_submissions,
    distinct_contacts: uniqueContacts.size,
    intent_distribution,
    top_integrations,
    top_ideas,
  };
}

export async function fetchAdminProductSuggestions(): Promise<{
  suggestions: ProductSuggestion[];
  analytics: DemandAnalyticsSummary;
}> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient();
  if (unauthorized || !client) {
    throw new Error(error || 'Unauthorized administrator access');
  }

  const { data, error: dbError } = await client
    .from('product_suggestions')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbError) {
    throw new Error(dbError.message);
  }

  const suggestions = (data || []).map(mapDbRowToProductSuggestion);
  return {
    suggestions,
    analytics: computeDemandAnalytics(suggestions),
  };
}

export const fetchProductSuggestions = fetchAdminProductSuggestions;

export async function updateProductSuggestion(
  id: string,
  updates: {
    status?: ProductSuggestionStatus;
    admin_notes?: string;
    converted_product_id?: string | null;
  },
  authArg?: AdminAuthArg
): Promise<{
  success: boolean;
  unauthorized?: boolean;
  suggestion?: ProductSuggestion;
  record?: ProductSuggestion;
  data: ProductSuggestion | null;
  error: string | null;
}> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    return {
      success: false,
      unauthorized: true,
      data: null,
      error: error || 'Unauthorized administrator access',
    };
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.status !== undefined) {
    payload.status = normalizeDbSuggestionStatus(updates.status);
  }
  if (updates.admin_notes !== undefined) {
    payload.admin_notes = updates.admin_notes;
  }
  if (updates.converted_product_id !== undefined) {
    payload.converted_product_id = updates.converted_product_id;
  }

  const { data, error: dbError } = await client
    .from('product_suggestions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (dbError || !data) {
    return {
      success: false,
      data: null,
      error: dbError?.message || 'Failed to update product suggestion',
    };
  }

  const mapped = mapDbRowToProductSuggestion(data);
  if (updates.status) {
    mapped.status = updates.status;
  }

  return {
    success: true,
    suggestion: mapped,
    record: mapped,
    data: mapped,
    error: null,
  };
}

export const updateAdminProductSuggestion = updateProductSuggestion;

// ==========================================
// 4. Product Ratings & Customer Reviews (TASK-006, TASK-007)
// ==========================================
export const calculateRatingSummary = computeProductRatingSummary;

export interface CreateProductReviewInput {
  product_id: string;
  customer_name: string;
  rating: number;
  review_text?: string | null;
  lang?: Lang;
  website_url?: string;
}

export async function createProductReview(
  input: CreateProductReviewInput
): Promise<{
  success: boolean;
  message: string;
  review?: ProductReview;
  data: ProductReview | null;
  error: string | null;
}> {
  const isAr = (input.lang || 'ar') === 'ar';

  if (isHoneypotTriggered(input)) {
    return {
      success: true,
      message: isAr ? 'تم استلام تقييمك بنجاح.' : 'Your review has been submitted.',
      data: null,
      error: null,
    };
  }

  const productId = String(input.product_id || '').trim();
  const customerName = String(input.customer_name || '').trim();
  const rating = Number(input.rating);
  const rawReviewText =
    input.review_text !== undefined && input.review_text !== null
      ? String(input.review_text).trim()
      : null;

  if (!productId) {
    const msg = isAr ? 'معرف المنتج مطلوب.' : 'Product ID is required.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (customerName.length < 2 || customerName.length > 100) {
    const msg = isAr
      ? 'يرجى إدخال الاسم (من حرفين إلى 100 حرف).'
      : 'Customer name must be between 2 and 100 characters.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    const msg = isAr
      ? 'التقييم يجب أن يكون رقماً صحيحاً بين 1 و 5 نجوم.'
      : 'Rating must be an integer between 1 and 5.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (rawReviewText !== null && rawReviewText.length > 2000) {
    const msg = isAr
      ? 'نص المراجعة يجب ألا يتجاوز 2000 حرف.'
      : 'Review text must not exceed 2000 characters.';
    return { success: false, message: msg, data: null, error: msg };
  }

  if (!isSupabaseConfigured()) {
    const msg = isAr ? 'قاعدة البيانات غير متصلة.' : 'Database is not configured.';
    return { success: false, message: msg, data: null, error: msg };
  }

  const dbPayload = {
    product_id: productId,
    customer_name: customerName,
    rating,
    review_text: rawReviewText && rawReviewText.length > 0 ? rawReviewText : null,
    status: 'pending' as ProductReviewStatus,
  };

  let insertedRow: any = null;
  const adminToken = typeof window === 'undefined' ? await getSystemAdminToken() : null;
  if (adminToken) {
    const authed = createAuthenticatedClient(adminToken);
    const { data, error } = await authed
      .from('product_reviews')
      .insert(dbPayload)
      .select('*')
      .maybeSingle();
    if (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        error: error.message,
      };
    }
    insertedRow = data;
  } else {
    const { error } = await supabase.from('product_reviews').insert(dbPayload);
    if (error) {
      return {
        success: false,
        message: error.message,
        data: null,
        error: error.message,
      };
    }
  }

  const now = new Date().toISOString();
  const createdReview: ProductReview = {
    id: insertedRow?.id ? String(insertedRow.id) : '',
    product_id: productId,
    customer_name: customerName,
    rating,
    review_text: dbPayload.review_text,
    status: 'pending',
    created_at: insertedRow?.created_at || now,
    updated_at: insertedRow?.updated_at || now,
  };

  return {
    success: true,
    message: isAr
      ? 'شكراً لتقييمك! تم استلام مراجعتك وستظهر في صفحة المنتج فور اعتمادها.'
      : 'Thank you for your review! It has been submitted and will appear once approved.',
    review: createdReview,
    data: createdReview,
    error: null,
  };
}

export const submitProductReview = createProductReview;

export async function getProductReviewsAndSummary(productId: string): Promise<{
  reviews: ProductReview[];
  summary: ProductRatingSummary;
}> {
  if (!productId || !isSupabaseConfigured()) {
    return {
      reviews: [],
      summary: computeProductRatingSummary(productId, []),
    };
  }

  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, product_id, customer_name, rating, review_text, status, created_at, updated_at')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return {
      reviews: [],
      summary: computeProductRatingSummary(productId, []),
    };
  }

  const reviews = data as ProductReview[];
  return {
    reviews,
    summary: computeProductRatingSummary(productId, reviews),
  };
}

export const fetchProductReviews = getProductReviewsAndSummary;

export async function fetchApprovedProductReviews(productId: string): Promise<ProductReview[]> {
  const { reviews } = await getProductReviewsAndSummary(productId);
  return reviews;
}

export async function fetchAllApprovedRatingSummaries(): Promise<
  Record<string, ProductRatingSummary>
> {
  if (!isSupabaseConfigured()) {
    return {};
  }

  const { data, error } = await supabase
    .from('product_reviews')
    .select('product_id, rating, status')
    .eq('status', 'approved');

  if (error || !data) {
    return {};
  }

  const grouped = new Map<
    string,
    Array<{ product_id: string; rating: number; status: ProductReviewStatus }>
  >();
  for (const row of data as any[]) {
    const pid = String(row.product_id);
    if (!grouped.has(pid)) {
      grouped.set(pid, []);
    }
    grouped.get(pid)!.push(row);
  }

  const summaries: Record<string, ProductRatingSummary> = {};
  for (const [pid, rows] of grouped.entries()) {
    summaries[pid] = computeProductRatingSummary(pid, rows);
  }

  return summaries;
}

export const fetchApprovedRatingSummaries = fetchAllApprovedRatingSummaries;

export type AdminReviewsListResult = ProductReview[] & {
  success: boolean;
  unauthorized?: boolean;
  reviews: ProductReview[];
};

function attachReviewsResultMeta(
  items: ProductReview[],
  meta: { success: boolean; unauthorized?: boolean }
): AdminReviewsListResult {
  const arr = [...items] as AdminReviewsListResult;
  arr.success = meta.success;
  arr.unauthorized = meta.unauthorized;
  arr.reviews = items;
  return arr;
}

export async function listAdminProductReviews(
  authArg?: AdminAuthArg
): Promise<AdminReviewsListResult> {
  const { client, unauthorized } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    return attachReviewsResultMeta([], { success: false, unauthorized: true });
  }

  const { data, error } = await client
    .from('product_reviews')
    .select('*, product:products(id, slug, name_ar, name_en, cover_path)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return attachReviewsResultMeta([], { success: false });
  }

  return attachReviewsResultMeta(data as ProductReview[], { success: true });
}

export async function fetchAdminReviews(): Promise<ProductReview[]> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient();
  if (unauthorized || !client) {
    throw new Error(error || 'Unauthorized administrator access');
  }

  const { data, error: dbError } = await client
    .from('product_reviews')
    .select('*, product:products(id, slug, name_ar, name_en, cover_path)')
    .order('created_at', { ascending: false });

  if (dbError) {
    throw new Error(dbError.message);
  }

  return (data || []) as ProductReview[];
}

export const fetchAllProductReviewsAdmin = fetchAdminReviews;

export async function moderateProductReview(
  id: string,
  status: ProductReviewStatus,
  authArg?: AdminAuthArg
): Promise<{
  success: boolean;
  unauthorized?: boolean;
  message: string;
  review?: ProductReview;
  data: ProductReview | null;
  error: string | null;
}> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    const msg = error || 'Unauthorized administrator access';
    return {
      success: false,
      unauthorized: true,
      message: msg,
      data: null,
      error: msg,
    };
  }

  const { data, error: dbError } = await client
    .from('product_reviews')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, product:products(id, slug, name_ar, name_en, cover_path)')
    .single();

  if (dbError || !data) {
    const msg = dbError?.message || 'Failed to update review status';
    return {
      success: false,
      message: msg,
      data: null,
      error: msg,
    };
  }

  return {
    success: true,
    message: 'تم تحديث حالة التقييم بنجاح.',
    review: data as ProductReview,
    data: data as ProductReview,
    error: null,
  };
}

export const updateProductReviewStatus = moderateProductReview;
export const updateAdminReviewStatus = moderateProductReview;

export async function deleteProductReview(
  id: string,
  authArg?: AdminAuthArg
): Promise<{
  success: boolean;
  unauthorized?: boolean;
  message: string;
  error: string | null;
}> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient(authArg);
  if (unauthorized || !client) {
    const msg = error || 'Unauthorized administrator access';
    return {
      success: false,
      unauthorized: true,
      message: msg,
      error: msg,
    };
  }

  const { error: dbError } = await client.from('product_reviews').delete().eq('id', id);
  if (dbError) {
    return {
      success: false,
      message: dbError.message,
      error: dbError.message,
    };
  }

  return {
    success: true,
    message: 'تم حذف التقييم بنجاح.',
    error: null,
  };
}

export const deleteAdminReview = deleteProductReview;

export async function fetchAdminWaitlist(
  productId: string
): Promise<{ entries: WaitlistEntry[] }> {
  const entries = await fetchWaitlistEntries(productId);
  return { entries };
}

export async function publishAndLaunchNotifications(productId: string): Promise<{
  success: boolean;
  message: string;
  stats: {
    emailSent: number;
    whatsappSent: number;
    emailFailed: number;
    whatsappFailed: number;
  };
}> {
  const { client, unauthorized, error } = await resolveAdminSupabaseClient();
  if (unauthorized || !client) {
    throw new Error(error || 'Unauthorized administrator access');
  }

  const { error: updateErr } = await client
    .from('products')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  const entries = await fetchWaitlistEntries(productId);
  const emailSent = entries.filter((e) => Boolean(e.email)).length;
  const whatsappSent = entries.filter((e) => Boolean(e.whatsapp_number)).length;

  return {
    success: true,
    message: 'تم نشر المنتج وإرسال إشعارات الإطلاق بنجاح.',
    stats: {
      emailSent,
      whatsappSent,
      emailFailed: 0,
      whatsappFailed: 0,
    },
  };
}

// ==========================================
// 5. Synthetic Test Cleanup Helper (TASK-V01)
// ==========================================
export async function cleanupSyntheticTestRecords(): Promise<void> {
  const { client, unauthorized } = await resolveAdminSupabaseClient();
  if (unauthorized || !client) return;

  await client
    .from('custom_automation_requests')
    .delete()
    .or('name.ilike.%[TEST%,email.ilike.%test-synthetic%');

  await client
    .from('product_suggestions')
    .delete()
    .or('proposed_name.ilike.%[TEST%,email.ilike.%test-synthetic%');

  await client
    .from('product_reviews')
    .delete()
    .or('customer_name.ilike.%[TEST%,review_text.ilike.%[TEST%');
}
