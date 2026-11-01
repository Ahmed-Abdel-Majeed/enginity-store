import { WebhookRequestPayload, WebhookResponsePayload, WebhookResponseType } from './types';

export const FALLBACK_REPLY_AR = 'حصلت مشكلة مؤقتة، جرب تاني';
export const FALLBACK_REPLY_EN = 'A temporary issue occurred, please try again.';

export interface CallWebhookOptions {
  message: string;
  matched: string[];
  found: boolean;
  language?: string;
  sessionId?: string;
  conversationId?: string;
  page?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  fetchFn?: typeof fetch;
  webhookUrlOverride?: string;
}

/**
 * Resolves the configured n8n Assistant Webhook URL.
 * Checks runtime environment, vite env, or server proxy.
 */
export function getWebhookUrl(): string | null {
  if (typeof window !== 'undefined') {
    // In browser, use server-side proxy endpoint to protect secrets and avoid CORS
    return '/api/assistant/chat';
  }

  if (typeof process !== 'undefined' && process.env) {
    if (process.env.N8N_ASSISTANT_WEBHOOK_URL?.trim()) {
      return process.env.N8N_ASSISTANT_WEBHOOK_URL.trim();
    }
    if (process.env.VITE_N8N_ASSISTANT_WEBHOOK_URL?.trim()) {
      return process.env.VITE_N8N_ASSISTANT_WEBHOOK_URL.trim();
    }
  }

  return null;
}

/**
 * Safely parses n8n Webhook response JSON into a validated WebhookResponsePayload.
 * Expected schema:
 *   {"type":"chat|store_info|system_request", "reply":"نص", "show_cta":true|false}
 */
export function parseWebhookResponse(
  rawBody: unknown,
  lang: string = 'ar'
): WebhookResponsePayload {
  const fallbackReply = lang === 'en' ? FALLBACK_REPLY_EN : FALLBACK_REPLY_AR;

  if (!rawBody) {
    return {
      reply: fallbackReply,
      show_cta: false,
      type: 'chat',
      success: false
    };
  }

  let data: any = rawBody;
  if (typeof rawBody === 'string') {
    const trimmed = rawBody.trim();
    if (!trimmed) {
      return {
        reply: fallbackReply,
        show_cta: false,
        type: 'chat',
        success: false
      };
    }
    try {
      data = JSON.parse(trimmed);
    } catch {
      // Non-JSON response -> return fallback
      return {
        reply: fallbackReply,
        show_cta: false,
        type: 'chat',
        success: false
      };
    }
  }

  // Handle nested structure if returned inside output or data
  if (data && typeof data === 'object') {
    const candidate = data.output || data.response || data.data || data;
    if (candidate && typeof candidate === 'object') {
      data = candidate;
    }
  }

  const reply =
    typeof data?.reply === 'string' && data.reply.trim()
      ? data.reply.trim()
      : typeof data?.text === 'string' && data.text.trim()
      ? data.text.trim()
      : fallbackReply;

  // Validate type: support automation_request, store_info, chat; default unknown to chat
  let type: WebhookResponseType = 'chat';
  if (data?.type === 'automation_request' || data?.type === 'system_request') {
    type = 'automation_request';
  } else if (data?.type === 'store_info') {
    type = 'store_info';
  } else if (data?.type === 'chat') {
    type = 'chat';
  } else {
    type = 'chat';
  }

  // Extract optional platforms array
  const platforms: string[] | undefined = Array.isArray(data?.platforms)
    ? data.platforms.filter((p: unknown): p is string => typeof p === 'string' && Boolean(p.trim()))
    : undefined;

  const show_cta = type === 'automation_request';

  return {
    reply,
    type,
    ...(platforms && platforms.length > 0 ? { platforms } : {}),
    show_cta,
    success: reply !== fallbackReply
  };
}

/**
 * Dispatches the message to n8n Webhook with matched platforms and found=false flag.
 * Enforces a strict 10-second timeout, error resilience, and friendly fallback.
 */
export async function sendToN8nWebhook(
  options: CallWebhookOptions
): Promise<WebhookResponsePayload> {
  const lang = options.language === 'en' ? 'en' : 'ar';
  const fallbackReply = lang === 'en' ? FALLBACK_REPLY_EN : FALLBACK_REPLY_AR;

  const targetUrl = options.webhookUrlOverride || getWebhookUrl();

  if (!targetUrl) {
    return {
      reply:
        lang === 'en'
          ? 'Webhook URL is not configured. Please provide the n8n webhook URL.'
          : 'رابط الـ Webhook غير متوفر. يرجى تزويدنا برابط n8n Webhook للربط.',
      type: 'chat',
      show_cta: false,
      success: false
    };
  }

  const fetchImpl = options.fetchFn || fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const payload: WebhookRequestPayload = {
    message: options.message.trim(),
    matched: options.matched || [],
    found: options.found,
    sessionId: options.sessionId || 'anonymous',
    conversationId: options.conversationId || '',
    language: lang,
    page: options.page || '',
    history: (options.history || []).slice(-6)
  };

  try {
    const res = await fetchImpl(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      return {
        reply: fallbackReply,
        show_cta: false,
        type: 'chat',
        success: false
      };
    }

    const rawText = await res.text();
    return parseWebhookResponse(rawText, lang);
  } catch {
    // Network error, DNS resolution failure, abort / timeout
    return {
      reply: fallbackReply,
      show_cta: false,
      type: 'chat',
      success: false
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
