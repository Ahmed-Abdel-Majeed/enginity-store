import { z } from 'zod';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_REGEX = /^[+\d][\d\s\-()]{6,22}$/;

/**
 * Shared honeypot validation: if a bot fills the hidden `website_url` field,
 * validation marks `isBotHoneypot: true` so the caller can short-circuit cleanly.
 */
export function isHoneypotTriggered(
  payload?: string | null | { website_url?: string | null }
): boolean {
  if (!payload) return false;
  if (typeof payload === 'string') {
    return payload.trim().length > 0;
  }
  return Boolean(payload.website_url && String(payload.website_url).trim().length > 0);
}

const cooldownStore = new Map<string, number>();

export function checkSubmissionCooldown(
  formKey: string,
  cooldownMs = 60_000,
  now = Date.now()
): { allowed: boolean; remainingSeconds: number } {
  let lastSubmitted = cooldownStore.get(formKey) || 0;

  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(`enginity_cooldown_${formKey}`);
      if (stored) {
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed > lastSubmitted) {
          lastSubmitted = parsed;
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }

  const elapsed = now - lastSubmitted;
  if (lastSubmitted > 0 && elapsed < cooldownMs) {
    return {
      allowed: false,
      remainingSeconds: Math.ceil((cooldownMs - elapsed) / 1000),
    };
  }

  return { allowed: true, remainingSeconds: 0 };
}

export function recordSubmissionTimestamp(formKey: string, now = Date.now()): void {
  cooldownStore.set(formKey, now);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(`enginity_cooldown_${formKey}`, String(now));
    } catch {
      // Ignore storage access errors
    }
  }
}

export function clearSubmissionCooldowns(): void {
  cooldownStore.clear();
  if (typeof window !== 'undefined') {
    try {
      Object.keys(window.sessionStorage).forEach((k) => {
        if (k.startsWith('enginity_cooldown_')) {
          window.sessionStorage.removeItem(k);
        }
      });
    } catch {
      // Ignore
    }
  }
}

export const waitlistSubmissionSchema = z
  .object({
    product_id: z.string().trim().min(1, 'Product ID is required').max(128),
    email: z
      .string()
      .trim()
      .max(254, 'Email is too long')
      .optional()
      .default('')
      .refine((v) => !v || (v.length >= 5 && EMAIL_REGEX.test(v)), 'Invalid email format')
      .transform((v) => v.toLowerCase()),
    whatsapp_number: z
      .string()
      .trim()
      .max(30, 'Phone number is too long')
      .optional()
      .default('')
      .refine((v) => !v || PHONE_REGEX.test(v), 'Invalid WhatsApp phone format'),
    email_consent: z.boolean().optional(),
    whatsapp_consent: z.boolean().optional(),
    interest_note: z
      .string()
      .trim()
      .max(1000, 'Interest note must be 1000 characters or fewer')
      .optional()
      .default(''),
    website_url: z.string().optional().default(''),
  })
  .refine((data) => Boolean(data.email || data.whatsapp_number), {
    message: 'Either a valid email or WhatsApp number is required',
    path: ['email'],
  });

export const customRequestSubmissionSchema = z
  .object({
    name: z.string().trim().max(120, 'Name must be 120 characters or fewer').optional().default(''),
    full_name: z
      .string()
      .trim()
      .max(120, 'Full name must be 120 characters or fewer')
      .optional()
      .default(''),
    brand_name: z.string().trim().max(150).optional().default(''),
    industry: z.string().trim().max(150).optional().default(''),
    business_type: z.string().trim().max(150).optional().default(''),
    email: z
      .string()
      .trim()
      .min(5, 'Email is required')
      .max(254, 'Email is too long')
      .regex(EMAIL_REGEX, 'Invalid email format')
      .transform((v) => v.toLowerCase()),
    whatsapp_number: z
      .string()
      .trim()
      .max(30, 'WhatsApp number is too long')
      .optional()
      .default('')
      .refine((v) => !v || PHONE_REGEX.test(v), 'Invalid WhatsApp number format'),
    preferred_contact_method: z.enum(['whatsapp', 'email', 'both']).default('whatsapp'),
    business_description: z.string().trim().max(3000).optional().default(''),
    business_problem: z.string().trim().max(2000).optional().default(''),
    current_workflow: z.string().trim().max(3000).optional().default(''),
    pain_points: z.string().trim().max(3000).optional().default(''),
    automation_goal: z.string().trim().max(2000).optional().default(''),
    desired_outcome: z.string().trim().max(2000).optional().default(''),
    platforms_involved: z.array(z.string().trim().max(80)).max(30).default([]),
    current_tools: z.array(z.string().trim().max(80)).max(30).default([]),
    existing_tools: z.string().trim().max(1000).optional().default(''),
    expected_features: z.string().trim().max(2000).optional().default(''),
    expected_volume: z.string().trim().max(200).optional().default(''),
    timeline_urgency: z
      .enum(['urgent', '1_2_weeks', 'within_month', 'flexible'])
      .default('flexible'),
    delivery_timeframe: z.string().trim().max(200).optional().default(''),
    budget_range: z.string().trim().max(150).optional().default(''),
    need_consultation_first: z.boolean().default(false),
    marketing_consent: z.boolean().default(true),
    additional_notes: z.string().trim().max(2000).optional().default(''),
    website_url: z.string().optional().default(''),
  })
  .superRefine((data, ctx) => {
    const resolvedName = (data.full_name || data.name || '').trim();
    if (resolvedName.length < 2 || resolvedName.length > 120) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['full_name'],
        message: 'Full name must be between 2 and 120 characters',
      });
    }

    const resolvedGoal = (
      data.automation_goal ||
      data.desired_outcome ||
      data.business_problem ||
      data.pain_points ||
      ''
    ).trim();
    if (resolvedGoal.length < 5 || resolvedGoal.length > 2000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['automation_goal'],
        message: 'Automation goal / problem description must be between 5 and 2000 characters',
      });
    }
  });

export const productSuggestionSubmissionSchema = z.object({
  proposed_name: z
    .string()
    .trim()
    .min(2, 'Proposed product name must be at least 2 characters')
    .max(200, 'Proposed product name must be 200 characters or fewer'),
  problem_solved: z
    .string()
    .trim()
    .min(5, 'Problem description must be at least 5 characters')
    .max(3000, 'Problem description must be 3000 characters or fewer'),
  target_audience: z
    .string()
    .trim()
    .max(500)
    .optional()
    .default('General Business')
    .transform((v) => v || 'General Business'),
  expected_features: z.string().trim().max(2000).optional().default(''),
  platforms_integrations: z.array(z.string().trim().max(80)).max(30).default([]),
  email: z
    .string()
    .trim()
    .max(254)
    .optional()
    .default('')
    .refine((v) => !v || EMAIL_REGEX.test(v), 'Invalid email format')
    .transform((v) => v.toLowerCase()),
  whatsapp_number: z
    .string()
    .trim()
    .max(30)
    .optional()
    .default('')
    .refine((v) => !v || PHONE_REGEX.test(v), 'Invalid WhatsApp phone format'),
  purchase_likelihood: z
    .enum([
      'very_likely',
      'likely',
      'not_sure',
      'unlikely',
      'definitely',
      'probably',
      'maybe',
      'just_idea',
    ])
    .default('very_likely')
    .transform((val): 'very_likely' | 'likely' | 'not_sure' | 'unlikely' => {
      if (val === 'definitely' || val === 'very_likely') return 'very_likely';
      if (val === 'probably' || val === 'likely') return 'likely';
      if (val === 'maybe' || val === 'not_sure') return 'not_sure';
      return 'unlikely';
    }),
  preferred_price_range: z.string().trim().max(150).optional().default(''),
  additional_context: z.string().trim().max(2000).optional().default(''),
  contact_consent: z.boolean().default(false),
  website_url: z.string().optional().default(''),
});

export const reviewSubmissionSchema = z.object({
  product_id: z.string().trim().min(1, 'Product ID is required').max(128),
  customer_name: z
    .string()
    .trim()
    .min(2, 'Name must be between 2 and 80 characters')
    .max(80, 'Name must be between 2 and 80 characters'),
  rating: z
    .number()
    .int('Rating must be an integer between 1 and 5')
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  review_text: z
    .string()
    .trim()
    .min(5, 'Review text must be at least 5 characters')
    .max(2000, 'Review text must be 2000 characters or fewer'),
  website_url: z.string().optional().default(''),
});

export const orderInitSchema = z.object({
  product_id: z.string().trim().min(1, 'Product ID is required').max(128),
  customer_name: z
    .string()
    .trim()
    .min(2, 'Customer name must be at least 2 characters')
    .max(120, 'Customer name must be 120 characters or fewer'),
  customer_email: z
    .string()
    .trim()
    .min(5, 'Customer email is required')
    .max(254, 'Customer email is too long')
    .regex(EMAIL_REGEX, 'Invalid customer email format')
    .transform((v) => v.toLowerCase()),
  customer_phone: z
    .string()
    .trim()
    .min(7, 'Customer phone is required')
    .max(30, 'Customer phone is too long')
    .refine((v) => PHONE_REGEX.test(v), 'Invalid phone number format'),
  website_url: z.string().optional().default(''),
});
