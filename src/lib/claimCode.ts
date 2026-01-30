import crypto from "node:crypto";

const CLAIM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CLAIM_CODE_GROUP_SIZE = 4;
const CLAIM_CODE_GROUPS = 3;
const CLAIM_CODE_LENGTH = CLAIM_CODE_GROUP_SIZE * CLAIM_CODE_GROUPS;

export function generateClaimCode(): string {
  const bytes = crypto.randomBytes(CLAIM_CODE_LENGTH);
  let raw = "";
  for (let i = 0; i < CLAIM_CODE_LENGTH; i += 1) {
    raw += CLAIM_CODE_ALPHABET[bytes[i] & 31];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function hashClaimCode(claimCode: string): string {
  return crypto.createHash("sha256").update(claimCode).digest("hex");
}

export function isFormattedClaimCode(value: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}(?:-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}){2}$/.test(value);
}

export function normalizeFormattedClaimCode(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}
