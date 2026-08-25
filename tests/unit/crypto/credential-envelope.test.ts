import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  decryptCredential,
  encryptCredential,
} from "@/lib/crypto/credential-envelope";

const config = { key: Buffer.alloc(32, 7), keyVersion: 1 } as const;

describe("credential envelopes", () => {
  it("round trips only with the bound tenant and account", () => {
    const envelope = encryptCredential(
      "secret-token",
      "org-a",
      "account-a",
      config,
    );
    expect(decryptCredential(envelope, "org-a", "account-a", config)).toBe(
      "secret-token",
    );
    expect(() =>
      decryptCredential(envelope, "org-b", "account-a", config),
    ).toThrow();
    expect(JSON.stringify(envelope)).not.toContain("secret-token");
  });

  it("rejects tampering and unavailable key versions", () => {
    const envelope = encryptCredential(
      "secret-token",
      "org-a",
      "account-a",
      config,
    );
    expect(() =>
      decryptCredential(
        {
          ...envelope,
          ciphertext: `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}`,
        },
        "org-a",
        "account-a",
        config,
      ),
    ).toThrow();
    expect(() =>
      decryptCredential(envelope, "org-a", "account-a", {
        ...config,
        keyVersion: 2,
      }),
    ).toThrow("credential_key_version_unavailable");
  });
});
