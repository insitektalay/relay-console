export const RELAY_ATTACHMENT_UPLOAD_CONTRACT =
  "clawchat.relay.attachment-binary.v1";
export const RELAY_ATTACHMENT_UPLOAD_TOKEN_VERSION = 1;
export const RELAY_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;
export const RELAY_ATTACHMENT_CHUNK_BYTES = 64 * 1024;
export const RELAY_ATTACHMENT_UPLOAD_TOKEN_TTL_MS = 15 * 60_000;
export const RELAY_ATTACHMENT_UPLOAD_LEASE_MS = 5 * 60_000;
export const RELAY_ATTACHMENT_ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "application/json",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
