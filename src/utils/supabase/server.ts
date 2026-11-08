import "server-only";

import { createServiceClient } from "@/lib/supabase/server";

export async function createClient() {
  return createServiceClient();
}
