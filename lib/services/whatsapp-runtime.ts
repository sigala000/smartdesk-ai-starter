import "server-only";

import { requireWhatsAppConfig } from "@/lib/config/env-schema";
import { serverEnvironment } from "@/lib/config/env-server";
import { MetaWhatsAppClient } from "@/lib/meta/whatsapp-client";
import { SupabaseWhatsAppRepository } from "@/lib/repositories/supabase-whatsapp-repository";
import { createPublicConversationRuntime } from "@/lib/services/public-conversation-runtime";
import { WhatsAppChannelService } from "@/lib/services/whatsapp-channel-service";
import { createAdminClient } from "@/lib/supabase/admin";

export function createWhatsAppRuntime(request?: typeof fetch) {
  const config = requireWhatsAppConfig(serverEnvironment);
  if (!config) return null;
  return {
    config,
    service: new WhatsAppChannelService(
      new SupabaseWhatsAppRepository(createAdminClient()),
      createPublicConversationRuntime(),
      new MetaWhatsAppClient(config, request),
      config,
    ),
  };
}
