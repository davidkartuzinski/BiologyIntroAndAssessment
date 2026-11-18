import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/server";

export type ServiceStatus = {
  supabase: boolean;
  ai: boolean;
  email: boolean;
  /** True on a Vercel production deployment. */
  production: boolean;
  /** Local demonstration mode: persistence is missing and this is not production. */
  demoMode: boolean;
};

export function getServiceStatus(): ServiceStatus {
  const production = process.env.VERCEL_ENV === "production";
  const supabase = isSupabaseConfigured();
  const ai = Boolean(process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim());
  return {
    supabase,
    ai,
    // Email delivery is not implemented yet (Stage 4); always reported as off.
    email: false,
    production,
    demoMode: !supabase && !production,
  };
}
