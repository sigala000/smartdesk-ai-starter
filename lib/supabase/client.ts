import { createBrowserClient } from "@supabase/ssr";

import { publicEnvironment } from "@/lib/config/env-public";
import { requireSupabasePublicConfig } from "@/lib/config/env-schema";
import type { Database } from "@/lib/supabase/database.types";

export function createClient() {
  const config = requireSupabasePublicConfig(publicEnvironment);

  return createBrowserClient<Database>(config.url, config.anonKey);
}
