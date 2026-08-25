import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type CredentialEnvelope = Readonly<{
  keyVersion: number;
  ciphertext: string;
  initializationVector: string;
  authenticationTag: string;
}>;

const encode = (value: Buffer) => value.toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url");

export function encryptCredential(
  plaintext: string,
  organizationId: string,
  accountId: string,
  config: Readonly<{ key: Buffer; keyVersion: number }>,
): CredentialEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  cipher.setAAD(
    Buffer.from(`${organizationId}:${accountId}:cloud_api_access_token`),
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    keyVersion: config.keyVersion,
    ciphertext: encode(ciphertext),
    initializationVector: encode(iv),
    authenticationTag: encode(cipher.getAuthTag()),
  };
}

export function decryptCredential(
  envelope: CredentialEnvelope,
  organizationId: string,
  accountId: string,
  config: Readonly<{ key: Buffer; keyVersion: number }>,
): string {
  if (envelope.keyVersion !== config.keyVersion)
    throw new Error("credential_key_version_unavailable");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    config.key,
    decode(envelope.initializationVector),
  );
  decipher.setAAD(
    Buffer.from(`${organizationId}:${accountId}:cloud_api_access_token`),
  );
  decipher.setAuthTag(decode(envelope.authenticationTag));
  return Buffer.concat([
    decipher.update(decode(envelope.ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}
