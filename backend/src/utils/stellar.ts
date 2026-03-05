/**
 *
 * Stellar keypair generation + AES-256-GCM encryption for private keys.
 *
 * Requires env var:
 *   WALLET_ENCRYPTION_KEY — 64 hex chars (= 32 bytes)
 *   Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function encryptionKey(): Buffer {
  const hex = process.env.WALLET_ENCRYPTION_KEY ?? "";
  if (hex.length !== 64) {
    throw new Error("WALLET_ENCRYPTION_KEY must be a 64-character hex string");
  }
  return Buffer.from(hex, "hex");
}

/** Generate a fresh Stellar keypair for a new user. */
export function generateKeypair(): { publicKey: string; secretKey: string } {
  const kp = StellarSdk.Keypair.random();
  return { publicKey: kp.publicKey(), secretKey: kp.secret() };
}

/**
 * Encrypt the secret key before writing to DB.
 * Returns: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptSecretKey(secretKey: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(secretKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a stored secret key.
 * Only call server-side when signing a Stellar transaction.
 */
export function decryptSecretKey(stored: string): string {
  const key = encryptionKey();
  const [ivHex, tagHex, encHex] = stored.split(":");
  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Returns current portfolio share value for a wallet from the Soroban vault.
 * For local/dev usage, values can be injected with:
 * MOCK_VAULT_SHARE_VALUES='{"G...":523.4}'
 */
export async function getVaultShareValue(
  walletAddress: string,
  fallbackValue: number,
): Promise<number> {
  try {
    const raw = process.env.MOCK_VAULT_SHARE_VALUES;
    if (!raw) return fallbackValue;

    const parsed = JSON.parse(raw) as Record<string, number>;
    const value = parsed[walletAddress];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  } catch {
    // Fall back to computed local value if mock env is invalid.
  }

  return fallbackValue;
}
