export type Lang = 'ar' | 'en';
export type Currency = 'EGP' | 'USD';

export interface Category {
  id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  created_at?: string;
}

export type ProductLevel = 'beginner' | 'intermediate' | 'advanced';
export type ProductStatus = 'draft' | 'published' | 'coming_soon' | 'archived';

export interface RequirementItem {
  name: string;
  desc: string;
}

export interface StepItem {
  title: string;
  text: string;
}

export interface FaqItem {
  q_ar?: string;
  q_en?: string;
  a_ar?: string;
  a_en?: string;
  question?: string;
  answer?: string;
}

export interface Product {
  id: string;
  slug: string;
  status: ProductStatus;
  category_id: number;
  category?: Category;
  name_ar: string;
  name_en: string;
  short_ar?: string | null;
  short_en?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  price_egp: number;
  xpay_url?: string | null;
  cover_path?: string | null;
  diagram_path?: string | null;
  video_url?: string | null;
  tools: string[];
  level: ProductLevel;
  includes_ar: string[];
  includes_en: string[];
  requirements_ar: RequirementItem[];
  requirements_en: RequirementItem[];
  steps_ar: StepItem[];
  steps_en: StepItem[];
  faq: FaqItem[];
  sort_order: number;
  expected_launch_date?: string | null;
  launch_announcement?: string | null;
  waitlist_enabled?: boolean;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type WaitlistNotificationStatus = 'pending' | 'sent' | 'failed' | 'withdrawn';

export interface WaitlistEntry {
  id: string;
  product_id: string;
  email?: string;
  whatsapp_number?: string;
  email_consent: boolean;
  whatsapp_consent: boolean;
  consent_text_ar?: string;
  consent_text_en?: string;
  consent_timestamp?: string;
  email_status: WaitlistNotificationStatus;
  whatsapp_status: WaitlistNotificationStatus;
  email_attempts?: number;
  whatsapp_attempts?: number;
  email_last_attempt?: string;
  whatsapp_last_attempt?: string;
  email_delivery_time?: string;
  whatsapp_delivery_time?: string;
  last_error?: string;
  created_at?: string;
}

export interface WaitlistStats {
  total_subscribers: number;
  email_count: number;
  whatsapp_count: number;
  pending_count: number;
  sent_count: number;
  failed_count: number;
}

export interface GeneralFaq {
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
}

export interface StoreSettings {
  id: number;
  usd_rate: number;
  whatsapp_number: string;
  whatsapp_default_message: string;
  author_name: string;
  author_bio_ar: string;
  author_bio_en: string;
  author_photo: string;
  author_followers_text_ar: string;
  author_followers_text_en: string;
  contact_email: string;
  buy_notice_enabled?: boolean;
  buy_notice_ar?: string;
  buy_notice_en?: string;
  n8n_launch_webhook_url?: string;
  resend_api_key?: string;
  social_links: {
    youtube?: string;
    linkedin?: string;
    facebook?: string;
    portfolio?: string;
    twitter?: string;
    n8n_launch_webhook_url?: string;
    resend_api_key?: string;
  };
  general_faq: GeneralFaq[];
}

export interface AdminUser {
  user_id: string;
  email: string;
}

// Feature B: Custom Automation Requests
export type CustomRequestStatus =
  | 'new'
  | 'reviewing'
  | 'needs_clarification'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'completed';

export interface CustomAutomationRequest {
  id: string;
  name?: string;
  email: string;
  whatsapp_number?: string;
  business_type: string;
  business_problem: string;
  desired_outcome: string;
  current_tools: string[];
  expected_features?: string;
  budget_range?: string;
  delivery_timeframe?: string;
  additional_notes?: string;
  marketing_consent: boolean;
  status: CustomRequestStatus;
  estimated_quote_egp?: number | null;
  admin_notes?: string;
  notification_sent?: boolean;
  created_at: string;
  updated_at: string;
}

// Feature C: Customer Product Suggestions & Demand Validation
export type PurchaseLikelihood = 'very_likely' | 'likely' | 'not_sure' | 'unlikely';
export type ProductSuggestionStatus =
  | 'under_review'
  | 'planned'
  | 'converted_coming_soon'
  | 'rejected';

export interface ProductSuggestion {
  id: string;
  proposed_name: string;
  problem_solved: string;
  target_audience: string;
  expected_features?: string;
  platforms_integrations: string[];
  email?: string;
  whatsapp_number?: string;
  purchase_likelihood: PurchaseLikelihood;
  preferred_price_range?: string;
  additional_context?: string;
  contact_consent: boolean;
  fingerprint_hash?: string;
  status: ProductSuggestionStatus;
  converted_product_id?: string | null;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DemandIdeaGroup {
  normalized_title: string;
  display_name: string;
  submissions_count: number;
  distinct_contacts_count: number;
  high_intent_count: number; // very_likely + likely
  top_integrations: string[];
  latest_submission_at: string;
  sample_problem: string;
  target_audience: string;
  suggestion_ids: string[];
  status: ProductSuggestionStatus;
}

export interface DemandAnalyticsSummary {
  total_submissions: number;
  distinct_contacts: number;
  intent_distribution: {
    very_likely: number;
    likely: number;
    not_sure: number;
    unlikely: number;
  };
  top_integrations: { name: string; count: number }[];
  top_ideas: DemandIdeaGroup[];
}

// Feature A: Intelligent AI Shopping Assistant
export interface AssistantProductRecommendation {
  product_id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  short_ar: string;
  short_en: string;
  price_egp: number;
  status: 'published' | 'coming_soon';
  waitlist_enabled: boolean;
  level: ProductLevel;
  tools: string[];
  cover_path?: string;
  product_url_ar: string;
  product_url_en: string;
  match_reason_ar: string;
  match_reason_en: string;
  limitations_ar?: string;
  limitations_en?: string;
}

export type AssistantActionType =
  | 'view_product'
  | 'join_waitlist'
  | 'request_custom_system'
  | 'suggest_product'
  | 'contact_human_support';

export interface AssistantResponsePayload {
  reply_ar: string;
  reply_en: string;
  clarifying_questions_ar?: string[];
  clarifying_questions_en?: string[];
  recommendations: AssistantProductRecommendation[];
  suggested_actions: {
    type: AssistantActionType;
    label_ar: string;
    label_en: string;
    product_id?: string;
    product_slug?: string;
    prefill_topic?: string;
  }[];
  source_mode?: 'gemini_agent' | 'n8n_agent' | 'catalog_intelligence';
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  payload?: AssistantResponsePayload;
}

