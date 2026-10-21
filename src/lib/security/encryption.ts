import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

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

/**
 * Creates an HMAC-SHA256 signed OAuth state token containing event slug,
 * random nonce, and a 10-minute expiration timestamp.
 * Format: `<base64url(payload)>.<signature_hex>`
 */
export function createOAuthStateToken(slug: string): string {
  const nonce = randomBytes(24).toString("hex");
  const exp = Date.now() + 10 * 60 * 1000; // 10 minutes
  const payloadStr = JSON.stringify({ slug, nonce, exp });
  const payloadB64 = Buffer.from(payloadStr, "utf8").toString("base64url");

  const key = getDerivedKey();
  const signature = createHmac("sha256", key).update(payloadB64).digest("hex");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed OAuth state token.
 * Returns { slug, nonce } if valid, unexpired, and authentic; otherwise null.
 */
export function verifyOAuthStateToken(token: string): { slug: string; nonce: string } | null {
  if (!token || typeof token !== "string") return null;

  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);

  if (!payloadB64 || !providedSig) return null;

  try {
    const key = getDerivedKey();
    const expectedSig = createHmac("sha256", key).update(payloadB64).digest("hex");

    const providedBuf = Buffer.from(providedSig, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");

    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);

    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    if (typeof payload.slug !== "string" || !payload.slug) return null;
    if (typeof payload.nonce !== "string" || !payload.nonce) return null;

    return { slug: payload.slug, nonce: payload.nonce };
  } catch {
    return null;
  }
}
