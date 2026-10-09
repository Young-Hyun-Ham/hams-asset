import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
};

function getMasterKey() {
  const secret = process.env.HAMS_ASSET_ENCRYPTION_KEY || process.env.HAMS_SESSION_SECRET;
  if (!secret) throw new Error("HAMS_ASSET_ENCRYPTION_KEY is not configured.");
  return createHash("sha256").update(`hams-asset:envelope:v1:${secret}`).digest();
}

function encryptBytes(value: Buffer, key: Buffer): EncryptedEnvelope {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
}

function decryptBytes(envelope: EncryptedEnvelope, key: Buffer) {
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported encrypted asset format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]);
}

export function encryptAssetJson(value: unknown) {
  const recordSecret = randomBytes(32);
  const payload = encryptBytes(Buffer.from(JSON.stringify(value), "utf8"), recordSecret);
  const wrappedSecret = encryptBytes(recordSecret, getMasterKey());
  return {
    encryptedPayload: JSON.stringify(payload),
    wrappedSecret: JSON.stringify(wrappedSecret),
  };
}

export function decryptAssetJson<T>(encryptedPayload: string, wrappedSecret: string) {
  const recordSecret = decryptBytes(JSON.parse(wrappedSecret) as EncryptedEnvelope, getMasterKey());
  const json = decryptBytes(JSON.parse(encryptedPayload) as EncryptedEnvelope, recordSecret);
  return JSON.parse(json.toString("utf8")) as T;
}
