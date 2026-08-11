import "server-only";

import { resolveEmployeeAccess } from "@/lib/auth/access-context";
import { serverEnvironment } from "@/lib/config/env-server";
import { SupabaseAttachmentRepository } from "@/lib/repositories/supabase-attachment-repository";
import { AttachmentService } from "@/lib/services/attachment-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export function createPublicAttachmentRuntime() {
  return new AttachmentService(
    new SupabaseAttachmentRepository(createAdminClient()),
    undefined,
    serverEnvironment.ATTACHMENT_ALLOW_UNSCANNED ?? false,
  );
}

export async function createEmployeeAttachmentRuntime() {
  const client = await createClient();
  const access = await resolveEmployeeAccess(client);
  return {
    access,
    service: new AttachmentService(
      new SupabaseAttachmentRepository(createAdminClient(), client),
      undefined,
      serverEnvironment.ATTACHMENT_ALLOW_UNSCANNED ?? false,
    ),
  };
}
