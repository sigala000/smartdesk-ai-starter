import type { StatusVerificationProvider } from "@/lib/verification/status-verification-provider";
export class UnavailableProductionVerificationProvider implements StatusVerificationProvider {
  readonly exposesCode = false;
  async sendCode() {
    return { ok: false as const, code: "provider_unavailable" };
  }
}
