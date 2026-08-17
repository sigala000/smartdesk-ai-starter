export type VerificationDelivery = {
  destinationE164: string;
  code: string;
  expiresAt: Date;
  traceId: string;
};
export interface StatusVerificationProvider {
  readonly exposesCode: boolean;
  sendCode(
    input: VerificationDelivery,
  ): Promise<{ ok: true } | { ok: false; code: string }>;
}
