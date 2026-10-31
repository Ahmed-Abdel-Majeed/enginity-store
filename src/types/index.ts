export type Lang = 'ar' | 'en';
export type Language = Lang;
export type Currency = 'EGP' | 'USD';
export type ProductLevel = 'beginner' | 'intermediate' | 'advanced';
export type Level = ProductLevel;
export type ProductStatus = 'draft' | 'coming_soon' | 'published' | 'archived';

export type CustomRequestStatus =
  | 'new'
  | 'reviewing'
  | 'needs_clarification'
  | 'quoted'
  | 'accepted'
  | 'rejected'
  | 'completed';

export type ProductSuggestionStatus =
  | 'under_review'
  | 'planned'
  | 'converted_coming_soon'
  | 'rejected';

export type PurchaseLikelihood =
  | 'very_likely'
  | 'likely'
  | 'not_sure'
  | 'unlikely';

export type ProductReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Category {
  id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  sort_order: number;
  created_at?: string;
}

export interface RequirementItem {
  name: string;
  url?: string;
  desc?: string;
}

export interface StepItem {
  title: string;
  text: string;
}

export interface FaqItem {
  question?: string;
  answer?: string;
  q_ar?: string;
  a_ar?: string;
  q_en?: string;
  a_en?: string;
}

export type FAQItem = FaqItem;

export interface GeneralFaq {
  q_ar: string;
  a_ar: string;
  q_en: string;
  a_en: string;
}

/**
 * Public storefront Product model (TASK-001):
 * Sensitive fulfillment fields (`file_url`) and internal notes (`admin_notes`)
 * are stripped from public storefront queries.
 */
export interface Product {
  id: string;
  slug: string;
  status: ProductStatus;
  category_id: number;
  name_ar: string;
  name_en: string;
  short_ar: string;
  short_en: string;
  description_ar: string;
  description_en: string;
  price_egp: number;
  original_price_egp?: number | null;
  sale_price_egp?: number | null;
  discount_percentage?: number;
  xpay_url: string;
  file_url?: string;
  cover_path: string;
  diagram_path: string;
  video_url: string;
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
  launch_announcement?: string;
  waitlist_enabled?: boolean;
  admin_notes?: string;
  created_at?: string;
  updated_at?: string;
  category?: Category;
}

export interface AdminProduct extends Product {
  file_url: string;
  admin_notes: string;
}

export interface Order {
  id: string;
  product_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  amount_egp: number;
  currency: 'EGP';
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  xpay_transaction_id?: string | null;
  fulfilled_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface WaitlistEntry {
  id: string;
  product_id: string;
  email: string;
  whatsapp_number: string;
  interest_note?: string;
  email_consent?: boolean;
  whatsapp_consent?: boolean;
  email_status?: string;
  whatsapp_status?: string;
  lang?: Lang;
  notified?: boolean;
  created_at: string;
  product?: Pick<Product, 'id' | 'slug' | 'name_ar' | 'name_en' | 'status'>;
}

export interface CustomAutomationRequest {
  id: string;
  name: string;
  full_name: string;
  brand_name?: string;
  industry?: string;
  business_type: string;
  email: string;
  whatsapp_number: string;
  preferred_contact_method?: 'whatsapp' | 'email' | 'both';
  business_description?: string;
  business_problem: string;
  current_workflow?: string;
  pain_points?: string;
  automation_goal: string;
  desired_outcome: string;
  platforms_involved: string[];
  current_tools: string[];
  existing_tools?: string;
  expected_features: string;
  expected_volume?: string;
  timeline_urgency?: 'urgent' | '1_2_weeks' | 'within_month' | 'flexible';
  delivery_timeframe: string;
  budget_range: string;
  need_consultation_first?: boolean;
  marketing_consent: boolean;
  additional_notes: string;
  status: CustomRequestStatus;
  estimated_quote_egp: number | null;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

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

export interface DemandAnalyticsIdeaCluster {
  fingerprint: string;
  normalized_title: string;
  display_name: string;
  representative_name: string;
  problem_summary: string;
  submission_count: number;
  submissions_count: number;
  distinct_contacts_count: number;
  high_intent_count: number;
  integrations: string[];
  top_integrations: string[];
  latest_status: ProductSuggestionStatus;
  status: ProductSuggestionStatus;
  suggestion_ids: string[];
}

export interface DemandAnalyticsSummary {
  total_submissions: number;
  distinct_contacts: number;
  intent_distribution: Record<PurchaseLikelihood, number>;
  top_integrations: Array<{ name: string; count: number }>;
  top_ideas: DemandAnalyticsIdeaCluster[];
}

export interface ProductReview {
  id: string;
  product_id: string;
  customer_name: string;
  rating: number;
  review_text: string | null;
  status: ProductReviewStatus;
  created_at: string;
  updated_at: string;
  product?: Pick<Product, 'id' | 'slug' | 'name_ar' | 'name_en' | 'cover_path'>;
}

export interface ProductRatingSummary {
  productId: string;
  product_id?: string;
  averageRating: number;
  average_rating?: number;
  totalReviews: number;
  total_reviews?: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
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
  social_links: {
    facebook?: string;
    youtube?: string;
    instagram?: string;
    tiktok?: string;
    telegram?: string;
    x?: string;
    linkedin?: string;
    threads?: string;
    portfolio?: string;
    n8n_launch_webhook_url?: string;
    resend_api_key?: string;
    [key: string]: any;
  };
  general_faq: GeneralFaq[];
  buy_notice_enabled?: boolean;
  buy_notice_ar?: string;
  buy_notice_en?: string;
  n8n_launch_webhook_url?: string;
  resend_api_key?: string;
}

export type Settings = StoreSettings;

// ==========================================
// AI Shopping Assistant Types
// ==========================================
export type AssistantRouteType =
  | 'catalog'
  | 'general_agent'
  | 'clarification'
  | 'no_match'
  | 'security_refusal'
  | 'catalog_error';

export interface AssistantRoutingTrace {
  route: AssistantRouteType;
  reason: string;
  supabaseQueried: boolean;
  n8nCalled: boolean;
  n8nCallCount: number;
  matchedProductSlugs: string[];
  matchConfidence: 'high' | 'medium' | 'low' | 'none' | 'strong' | 'partial';
  supabaseError?: boolean | string;
}

export interface AssistantProductRecommendation {
  product_id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  short_ar: string;
  short_en: string;
  price_egp: number;
  original_price_egp?: number;
  sale_price_egp?: number | null;
  discount_percentage?: number;
  status: 'published' | 'coming_soon';
  waitlist_enabled?: boolean;
  level: ProductLevel;
  tools: string[];
  cover_path?: string;
  product_url_ar: string;
  product_url_en: string;
  match_reason_ar: string;
  match_reason_en: string;
  limitations_ar: string;
  limitations_en: string;
}

export interface AssistantSuggestedAction {
  type:
    | 'open_product'
    | 'view_product'
    | 'join_waitlist'
    | 'request_custom_system'
    | 'suggest_new_product'
    | 'suggest_product'
    | 'contact_human_support';
  label_ar: string;
  label_en: string;
  product_id?: string;
  product_slug?: string;
  prefill_topic?: string;
}

export interface AssistantResponsePayload {
  reply_ar: string;
  reply_en: string;
  recommendations: AssistantProductRecommendation[];
  clarifying_questions?: string[];
  clarifying_questions_ar?: string[];
  clarifying_questions_en?: string[];
  suggested_actions: AssistantSuggestedAction[];
  source_mode: 'catalog_intelligence' | 'n8n_agent';
  route: AssistantRouteType;
  routing_trace: AssistantRoutingTrace;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  payload?: AssistantResponsePayload;
  recommendations?: AssistantProductRecommendation[];
  clarifying_questions?: string[];
  suggested_actions?: AssistantSuggestedAction[];
  source_mode?: 'catalog_intelligence' | 'n8n_agent';
  route?: AssistantRouteType;
  routing_trace?: AssistantRoutingTrace;
}
