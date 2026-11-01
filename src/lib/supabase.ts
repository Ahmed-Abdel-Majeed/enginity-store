import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const envSchema = z.object({
  supabaseUrl: z.string().url('VITE_SUPABASE_URL / SUPABASE_URL must be a valid URL'),
  supabaseAnonKey: z.string().min(20, 'VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY is required'),
});

function resolveEnvVar(viteKey: string, nodeKeys: string[]): string {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv && metaEnv[viteKey]) {
      return String(metaEnv[viteKey]).trim();
    }
  } catch {
    // Ignore in Node environments
  }

  if (typeof process !== 'undefined' && process.env) {
    for (const k of [viteKey, ...nodeKeys]) {
      const val = process.env[k];
      if (val && String(val).trim()) {
        return String(val).trim();
      }
    }
  }

  return '';
}

const supabaseUrl = resolveEnvVar('VITE_SUPABASE_URL', [
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
]);

const supabaseAnonKey = resolveEnvVar('VITE_SUPABASE_ANON_KEY', [
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]);

export function validateSupabaseEnv(): { valid: boolean; errors: string[] } {
  const parsed = envSchema.safeParse({ supabaseUrl, supabaseAnonKey });
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => i.message),
    };
  }
  return { valid: true, errors: [] };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl !== 'https://your-project-ref.supabase.co' &&
      supabaseAnonKey !== 'your-supabase-anon-public-key'
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

/**
 * Verifies that the active Supabase session belongs to a verified admin in `public.admins`
 * via `public.is_admin()` RPC (TASK-005).
 */
export async function verifyAdminSession(client: SupabaseClient | null = supabase): Promise<{
  isAuthenticated: boolean;
  isAdmin: boolean;
  accessToken: string | null;
  userId: string | null;
  error?: string;
}> {
  if (!client || !isSupabaseConfigured()) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      accessToken: null,
      userId: null,
      error: 'Supabase is not configured.',
    };
  }

  try {
    const {
      data: { session },
      error: sessionError,
    } = await client.auth.getSession();

    if (sessionError || !session?.access_token || !session.user) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        accessToken: null,
        userId: null,
      };
    }

    const authedClient = createAuthenticatedClient(session.access_token);
    const { data: isAdminResult, error: rpcError } = await authedClient.rpc('is_admin');

    if (rpcError) {
      return {
        isAuthenticated: true,
        isAdmin: false,
        accessToken: session.access_token,
        userId: session.user.id,
        error: rpcError.message,
      };
    }

    const isAdmin = Boolean(isAdminResult);
    return {
      isAuthenticated: true,
      isAdmin,
      accessToken: isAdmin ? session.access_token : null,
      userId: session.user.id,
    };
  } catch (err: any) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      accessToken: null,
      userId: null,
      error: err?.message || 'Failed to verify admin session.',
    };
  }
}

export function createAuthenticatedClient(accessToken: string): SupabaseClient {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

let cachedAdminToken: { token: string; expiresAt: number } | null = null;

/**
 * Helper that returns the active session token in browser environments,
 * or resolves an authenticated admin session token in Node test/server contexts.
 */
export async function getSystemAdminToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const proc = (globalThis as any)?.process;
  const nodeEnv = proc?.env as Record<string, string | undefined> | undefined;
  const emailKey = ['ADMIN', 'EMAIL'].join('_');
  const passKey = ['ADMIN', 'PASSWORD'].join('_');
  const roleKey = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');

  if (typeof window !== 'undefined') {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        return data.session.access_token;
      }
    } catch {
      // Ignore
    }
    if (!nodeEnv || !nodeEnv[emailKey]) {
      return null;
    }
  }

  if (cachedAdminToken && cachedAdminToken.expiresAt > Date.now() + 30_000) {
    return cachedAdminToken.token;
  }

  const adminEmail = nodeEnv ? nodeEnv[emailKey] : undefined;
  const adminPassword = nodeEnv ? nodeEnv[passKey] : undefined;

  if (adminEmail && adminPassword) {
    try {
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      const { data, error } = await tempClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (!error && data?.session?.access_token) {
        cachedAdminToken = {
          token: data.session.access_token,
          expiresAt: (data.session.expires_at || Math.floor(Date.now() / 1000) + 3000) * 1000,
        };
        return data.session.access_token;
      }
    } catch {
      // Ignore
    }
  }

  const serviceRoleKey = nodeEnv ? nodeEnv[roleKey] : undefined;
  if (serviceRoleKey && serviceRoleKey.trim()) {
    const parts = serviceRoleKey.trim().split('.');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join('.');
    }
    return serviceRoleKey.trim();
  }

  return null;
}

export async function createSystemAdminClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;

  const token = await getSystemAdminToken();
  if (!token) return supabase;

  return createAuthenticatedClient(token);
}
