import "server-only";
import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { SupabaseHandoffRepository } from "@/lib/repositories/supabase-handoff-repository";
import { HandoffService } from "@/lib/services/handoff-service";
import { createClient } from "@/lib/supabase/server";
export async function createHandoffRuntime() {
  const client = await createClient();
  return {
    access: await resolveEmployeeAccess(client),
    service: new HandoffService(new SupabaseHandoffRepository(client)),
  };
}
