import type { StatusVerificationProvider } from "@/lib/verification/status-verification-provider";
export class DevelopmentMockVerificationProvider implements StatusVerificationProvider {
  readonly exposesCode: boolean;
  constructor(exposesCode: boolean, nodeEnv = process.env.NODE_ENV) {
    if (nodeEnv === "production")
      throw new Error("mock_status_provider_forbidden");
    this.exposesCode = exposesCode;
  }
  async sendCode() {
    return { ok: true as const };
  }
}
