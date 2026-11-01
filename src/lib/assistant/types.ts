import { Product } from '../../types';

export interface PlatformDefinition {
  id: string;
  name_ar: string;
  name_en: string;
  synonyms: string[];
  catalogTools: string[];
}

export interface PlatformMatchResult {
  matchedPlatforms: string[];
  products: Product[];
  found: boolean;
}

export type WebhookResponseType = 'chat' | 'store_info' | 'automation_request' | 'system_request';

export interface WebhookResponsePayload {
  type?: WebhookResponseType;
  reply: string;
  platforms?: string[];
  show_cta?: boolean;
  success?: boolean;
}

export interface WebhookRequestPayload {
  message: string;
  matched: string[];
  found: boolean;
  conversationId?: string;
  sessionId?: string;
  language?: string;
  page?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
