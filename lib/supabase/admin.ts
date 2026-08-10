import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  EnvironmentValidationError,
  requireSupabasePublicConfig,
} from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminClient() {
  const config = requireSupabasePublicConfig(serverEnvironment);
  const key = serverEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new EnvironmentValidationError(["SUPABASE_SERVICE_ROLE_KEY"]);
  return createClient<Database>(config.url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
