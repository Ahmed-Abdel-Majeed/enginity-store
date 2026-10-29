import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://zqiieksqbbvlfzejbetq.supabase.co';

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxaWlla3NxYmJ2bGZ6ZWpiZXRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NDY4MjMsImV4cCI6MjEwODUyMjgyM30._vOrhsRHBppZmzJWxhTNMFzivYIo-XxtGzz3uDMr4fU';

let rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (rawServiceKey && rawServiceKey.includes('.eyJpc3M')) {
  const secondIndex = rawServiceKey.indexOf('.eyJpc3M', rawServiceKey.indexOf('.eyJpc3M') + 1);
  if (secondIndex !== -1) {
    rawServiceKey = rawServiceKey.substring(0, secondIndex);
  }
}
const supabaseServiceRoleKey = rawServiceKey;

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  try {
    const url = new URL(supabaseUrl);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

function initSupabaseClient(urlStr: string, keyStr: string): SupabaseClient | null {
  if (!urlStr || !keyStr) return null;
  try {
    new URL(urlStr);
    return createClient(urlStr, keyStr);
  } catch {
    return null;
  }
}

// Client-side public Supabase instance (uses Anon key)
export const supabase = isSupabaseConfigured()
  ? initSupabaseClient(supabaseUrl, supabaseAnonKey)
  : null;

// Server-side admin Supabase instance (optionally passing authenticated admin token or service role key)
export const getSupabaseAdmin = (token?: string) => {
  if (!isSupabaseConfigured()) return null;

  if (supabaseServiceRoleKey) {
    return initSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
  }

  if (token) {
    try {
      return createClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => token,
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
    } catch {
      // fallback
    }
  }

  return initSupabaseClient(supabaseUrl, supabaseAnonKey);
};

let cachedAdminToken: { token: string; expiresAt: number } | null = null;

// Async function for server-side system tasks that guarantees authenticated admin privileges
export const getSystemAdminSupabase = async (): Promise<SupabaseClient | null> => {
  if (!isSupabaseConfigured()) return null;

  if (supabaseServiceRoleKey) {
    return initSupabaseClient(supabaseUrl, supabaseServiceRoleKey);
  }

  const now = Date.now();
  if (cachedAdminToken && now < cachedAdminToken.expiresAt) {
    const client = getSupabaseAdmin(cachedAdminToken.token);
    if (client) return client;
  }

  if (supabase) {
    try {
      const { data } = await supabase.auth.signInWithPassword({
        email: process.env.ADMIN_EMAIL || 'admin@enginity.com',
        password: process.env.ADMIN_PASSWORD || '123456'
      });
      if (data?.session?.access_token) {
        cachedAdminToken = {
          token: data.session.access_token,
          expiresAt: now + (data.session.expires_in - 60) * 1000
        };
        return getSupabaseAdmin(data.session.access_token);
      }
    } catch {
      // fallback
    }
  }

  return getSupabaseAdmin();
};


