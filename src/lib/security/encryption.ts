import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const PREFIX = "enc:v1:";

function getDerivedKey(): Buffer {
  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GOOGLE_CLIENT_SECRET ||
    "dazzwed-secure-token-vault-key-32b!";
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a sensitive credential (e.g. OAuth refresh token) with AES-256-GCM.
 * Formats as `enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext; // Already encrypted

  const key = getDerivedKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

/**
 * Decrypts an encrypted token. Seamlessly supports legacy unencrypted tokens.
 */
export function decryptToken(encryptedOrPlain: string): string {
  if (!encryptedOrPlain) return encryptedOrPlain;
  if (!encryptedOrPlain.startsWith(PREFIX)) return encryptedOrPlain; // Legacy unencrypted

  try {
    const parts = encryptedOrPlain.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return encryptedOrPlain;
    const [ivHex, tagHex, cipherHex] = parts;

    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(cipherHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    console.error("Token decryption failed:", err);
    return encryptedOrPlain;
  }
}
