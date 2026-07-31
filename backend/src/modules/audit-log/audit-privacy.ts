import { createHmac } from "crypto";
import { isIP } from "net";

export const AUDIT_ACTOR_TYPE_MAX_LENGTH = 64;
export const AUDIT_ACTOR_ID_MAX_LENGTH = 128;
export const AUDIT_EVENT_TYPE_MAX_LENGTH = 160;
export const AUDIT_RESOURCE_TYPE_MAX_LENGTH = 128;
export const AUDIT_RESOURCE_ID_MAX_LENGTH = 256;
export const AUDIT_USER_AGENT_MAX_LENGTH = 160;
export const AUDIT_METADATA_KEY_MAX_LENGTH = 64;
export const AUDIT_METADATA_STRING_MAX_LENGTH = 256;

const AUDIT_METADATA_MAX_DEPTH = 4;
const AUDIT_METADATA_MAX_KEYS = 32;
const AUDIT_METADATA_MAX_ARRAY_ITEMS = 20;
const LOG_UNSAFE_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060\u2066-\u2069\ufeff]/g;
const SENSITIVE_METADATA_KEY =
  /^(?:api[-_]?key|authorization|cookie|email|passphrase|password|secret|token|access[-_]?token|refresh[-_]?token)$/i;

type AuditTokenDomain = "account" | "network";

export function sanitizeAuditText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string" || maxLength < 1) return null;
  const safe = value
    .normalize("NFKC")
    .replace(LOG_UNSAFE_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return null;
  return Array.from(safe).slice(0, maxLength).join("");
}

export function tokenizeAuditIdentifier(
  secret: string | null | undefined,
  domain: AuditTokenDomain,
  value: unknown,
): string | null {
  const key = secret?.trim();
  const normalized = sanitizeAuditText(value, 512)?.toLowerCase();
  if (!key || !normalized) return null;
  const digest = createHmac("sha256", key)
    .update(`clawchat:audit:${domain}:v1\0${normalized}`, "utf8")
    .digest("base64url");
  return `${domain}:v1:${digest}`;
}

export function tokenizeAuditNetwork(
  secret: string | null | undefined,
  value: unknown,
): string | null {
  const normalized = sanitizeAuditText(value, 128)?.toLowerCase();
  if (!normalized || isIP(normalized) === 0) return null;
  return tokenizeAuditIdentifier(secret, "network", normalized);
}

export function sanitizeAuditMetadata(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  const sanitized = sanitizeMetadataValue(value, 0);
  if (
    !sanitized ||
    Array.isArray(sanitized) ||
    typeof sanitized !== "object"
  ) {
    return null;
  }
  return Object.keys(sanitized).length
    ? (sanitized as Record<string, unknown>)
    : null;
}

function sanitizeMetadataValue(
  value: unknown,
  depth: number,
): unknown | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    return (
      sanitizeAuditText(value, AUDIT_METADATA_STRING_MAX_LENGTH) ?? undefined
    );
  }
  if (value instanceof Date) return value.toISOString();
  if (depth >= AUDIT_METADATA_MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value
      .slice(0, AUDIT_METADATA_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeMetadataValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return undefined;

  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(
    0,
    AUDIT_METADATA_MAX_KEYS,
  )) {
    const key = sanitizeAuditText(rawKey, AUDIT_METADATA_KEY_MAX_LENGTH);
    if (
      !key ||
      SENSITIVE_METADATA_KEY.test(key) ||
      ["__proto__", "constructor", "prototype"].includes(key.toLowerCase())
    ) {
      continue;
    }
    const sanitized = sanitizeMetadataValue(rawValue, depth + 1);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}
