import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import type { RequestStatusRepository } from "@/lib/repositories/request-status-repository";
import type { StatusVerificationProvider } from "@/lib/verification/status-verification-provider";
export type StatusConfig = {
  secret: string;
  codeTtlSeconds: number;
  tokenTtlSeconds: number;
  maxAttempts: number;
  lockoutSeconds: number;
};
const generic = "The verification details are invalid or expired.";
function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export class RequestStatusService {
  constructor(
    private readonly repository: RequestStatusRepository,
    private readonly provider: StatusVerificationProvider,
    private readonly config: StatusConfig,
  ) {}
  private digest(kind: string, value: string) {
    return createHmac("sha256", this.config.secret)
      .update(`${kind}:${value}`)
      .digest("hex");
  }
  async challenge(input: {
    organizationSlug: string;
    referenceNumber: string;
    phone: string;
    ip: string;
    traceId?: string;
  }) {
    const traceId = input.traceId ?? randomUUID();
    const subject = this.digest(
      "status-subject",
      `${input.organizationSlug}:${input.referenceNumber}:${input.phone}`,
    );
    const ipAllowed = await this.repository.consumeRateLimit(
      null,
      "status_challenge_ip",
      this.digest("status-ip", input.ip),
      10,
      900,
    );
    const subjectAllowed = await this.repository.consumeRateLimit(
      null,
      "status_challenge_subject",
      subject,
      3,
      900,
    );
    if (!ipAllowed || !subjectAllowed)
      return {
        ok: false as const,
        code: "rate_limited" as const,
        message: "Please wait before requesting another verification code.",
      };
    const target = await this.repository.findTarget(
      input.organizationSlug,
      input.referenceNumber,
    );
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const real = !!target && equal(target.phone, input.phone);
    const expiresAt = new Date(
      Date.now() + this.config.codeTtlSeconds * 1000,
    ).toISOString();
    const challenge = await this.repository.createChallenge({
      id,
      organizationId: real ? target!.organizationId : null,
      requestId: real ? target!.requestId : null,
      subjectDigest: subject,
      codeDigest: this.digest("status-code", `${id}:${code}`),
      expiresAt,
      maxAttempts: this.config.maxAttempts,
      real,
      traceId,
    });
    const deliver =
      real && challenge.created
        ? async () => {
            const delivery = await this.provider.sendCode({
              destinationE164: target!.phone,
              code,
              expiresAt: new Date(expiresAt),
              traceId,
            });
            await this.repository.setDelivery(id, delivery.ok, traceId);
          }
        : undefined;
    return {
      ok: true as const,
      value: {
        challengeId: challenge.id,
        deliveryHint:
          "If the details match, a verification code will be sent to the confirmed contact number.",
        expiresAt: challenge.expiresAt,
        ...(real && challenge.created && this.provider.exposesCode
          ? { developmentCode: code }
          : {}),
      },
      deliver,
    };
  }
  async verify(input: {
    challengeId: string;
    code: string;
    ip: string;
    traceId?: string;
    organizationId?: string;
    conversationId?: string;
  }) {
    const traceId = input.traceId ?? randomUUID();
    const allowed = await this.repository.consumeRateLimit(
      null,
      "status_verify_ip",
      this.digest("verify-ip", input.ip),
      20,
      900,
    );
    if (!allowed)
      return {
        ok: false as const,
        code: "rate_limited" as const,
        message: "Please wait before trying again.",
      };
    const token = randomBytes(32).toString("base64url");
    const conversationToken = input.conversationId
      ? randomBytes(32).toString("base64url")
      : null;
    const result = await this.repository.verify({
      challengeId: input.challengeId,
      codeDigest: this.digest(
        "status-code",
        `${input.challengeId}:${input.code}`,
      ),
      tokenDigest: this.digest("status-token", token),
      conversationTokenDigest: conversationToken
        ? this.digest("status-conversation-token", conversationToken)
        : null,
      organizationId: input.organizationId ?? null,
      conversationId: input.conversationId ?? null,
      tokenTtlSeconds: this.config.tokenTtlSeconds,
      lockoutSeconds: this.config.lockoutSeconds,
      traceId,
    });
    return result.success && result.expiresAt
      ? {
          ok: true as const,
          value: { verificationToken: token, expiresAt: result.expiresAt },
        }
      : {
          ok: false as const,
          code: "verification_failed" as const,
          message: generic,
        };
  }
  async status(reference: string, token: string) {
    const allowed = await this.repository.consumeRateLimit(
      null,
      "status_read_token",
      this.digest("status-read", token),
      30,
      900,
    );
    if (!allowed)
      return {
        ok: false as const,
        code: "rate_limited" as const,
        message: "Please wait before checking the status again.",
      };
    const value = await this.repository.consumeStatus(
      this.digest("status-token", token),
      reference,
      randomUUID(),
    );
    return value
      ? { ok: true as const, value }
      : {
          ok: false as const,
          code: "verification_failed" as const,
          message: generic,
        };
  }
  async statusForConversation(input: {
    reference: string;
    organizationId: string;
    conversationId: string;
  }) {
    const value = await this.repository.consumeConversationStatus(
      input.organizationId,
      input.conversationId,
      input.reference,
      randomUUID(),
    );
    return value
      ? { ok: true as const, value }
      : {
          ok: false as const,
          code: "verification_failed" as const,
          message: generic,
        };
  }
}
