import "server-only";

import {
  requireMetaPlatformConfig,
  requireWhatsAppConfig,
} from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import { SupabaseWhatsAppRepository } from "@/lib/repositories/supabase-whatsapp-repository";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";
import { WhatsAppChannelService } from "@/lib/services/whatsapp-channel-service";
import { TenantWhatsAppSender } from "@/lib/services/tenant-whatsapp-sender";
import { createAdminClient } from "@/lib/supabase/admin";

export function createWhatsAppRuntime(request?: typeof fetch) {
  if (!serverEnvironment.META_WHATSAPP_ENABLED) return null;
  const platform = requireMetaPlatformConfig(serverEnvironment);
  let legacy: ReturnType<typeof requireWhatsAppConfig> = null;
  try {
    legacy = requireWhatsAppConfig(serverEnvironment);
  } catch {
    legacy = null;
  }
  const repository = new SupabaseWhatsAppRepository(createAdminClient());
  return {
    config: {
      ...platform,
      phoneNumberId: legacy?.phoneNumberId ?? "",
      businessAccountId: legacy?.businessAccountId ?? "",
      testRecipients: legacy?.testRecipients ?? [],
    },
    service: new WhatsAppChannelService(
      repository,
      createPublicConversationRuntime(),
      new TenantWhatsAppSender(repository, legacy, request),
      {
        phoneNumberId: legacy?.phoneNumberId ?? "",
        businessAccountId: legacy?.businessAccountId ?? "",
        testRecipients: legacy?.testRecipients ?? [],
      },
    ),
  };
}
