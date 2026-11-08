import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function supabaseUrl() {
  return firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
}

export function supabaseServiceRoleKey() {
  return firstEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}

let client: SupabaseClient | undefined;

export function createServiceClient() {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error("Supabase is not configured.");
  }

  client ??= createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}
