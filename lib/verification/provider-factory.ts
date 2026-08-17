import type { StatusVerificationProvider } from "@/lib/verification/status-verification-provider";
import { DevelopmentMockVerificationProvider } from "@/lib/verification/development-mock-provider";
import { UnavailableProductionVerificationProvider } from "@/lib/verification/production-provider";
export function createStatusVerificationProvider(
  config: { provider: "mock" | "production"; exposeMockCode: boolean },
  nodeEnv = process.env.NODE_ENV,
): StatusVerificationProvider {
  if (config.provider === "mock")
    return new DevelopmentMockVerificationProvider(
      config.exposeMockCode,
      nodeEnv,
    );
  return new UnavailableProductionVerificationProvider();
}
