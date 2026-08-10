import "server-only";

import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { SupabaseRequestRepository } from "@/lib/repositories/supabase-request-repository";
import { RequestService } from "@/lib/services/request-service";
import { createClient } from "@/lib/supabase/server";

export async function createRequestRuntime() {
  const client = await createClient();
  const access = await resolveEmployeeAccess(client);
  return {
    access,
    service: new RequestService(new SupabaseRequestRepository(client)),
  };
}
