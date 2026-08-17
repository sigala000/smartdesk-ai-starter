import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnvironment } from "@/lib/config/env-server";
import {
  EnvironmentValidationError,
  requireStatusVerificationConfig,
} from "@/lib/config/env-schema";
import { SupabaseRequestStatusRepository } from "@/lib/repositories/supabase-request-status-repository";
import { RequestStatusService } from "@/lib/services/request-status-service";
import { createStatusVerificationProvider } from "@/lib/verification/provider-factory";
export function createRequestStatusRuntime() {
  const config = requireStatusVerificationConfig(serverEnvironment);
  if (!config)
    throw new EnvironmentValidationError(["STATUS_VERIFICATION_ENABLED"]);
  return new RequestStatusService(
    new SupabaseRequestStatusRepository(createAdminClient()),
    createStatusVerificationProvider({
      provider: config.provider,
      exposeMockCode: config.exposeMockCode,
    }),
    config,
  );
}
