import { createHmac, timingSafeEqual } from "crypto";
import { shouldAssertProductionEnvironment } from "../../config/production-env";

export const OPENCLAW_ATTACHMENT_PROVENANCE_TOKEN_FIELD = "provenanceToken";
const OPENCLAW_ATTACHMENT_PROVENANCE_VERSION = "openclaw-local-v1";
const OPENCLAW_ATTACHMENT_PROVENANCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEV_ATTACHMENT_PROVENANCE_SECRET =
  "clawchat-dev-attachment-provenance-secret";

export type OpenClawAttachmentProvenanceInput = {
  id: string;
  workspaceId: string;
  threadId: string;
  bridgeDeviceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string | null;
  kind: string;
  storage: "openclaw_local";
  localMediaRef: string;
  createdAt?: string | null;
};

type OpenClawAttachmentProvenancePayload = OpenClawAttachmentProvenanceInput & {
  version: typeof OPENCLAW_ATTACHMENT_PROVENANCE_VERSION;
  issuedAt: string;
  sha256: string | null;
  createdAt: string | null;
};

export function signOpenClawAttachmentProvenance(
  input: OpenClawAttachmentProvenanceInput,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  const payload = encodePayload({
    ...canonicalizeOpenClawAttachment(input),
    version: OPENCLAW_ATTACHMENT_PROVENANCE_VERSION,
    issuedAt: now.toISOString(),
  });
  return `${payload}.${signPayload(payload, env)}`;
}

export function verifyOpenClawAttachmentProvenance(
  input: OpenClawAttachmentProvenanceInput,
  token: string,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  const [payloadPart, signaturePart, ...extraParts] = token.split(".");
  if (!payloadPart || !signaturePart || extraParts.length > 0) {
    return false;
  }

  if (!safeEqual(signaturePart, signPayload(payloadPart, env))) {
    return false;
  }

  const payload = decodePayload(payloadPart);
  if (!payload || payload.version !== OPENCLAW_ATTACHMENT_PROVENANCE_VERSION) {
    return false;
  }

  const issuedAtMs = Date.parse(payload.issuedAt);
  if (
    !Number.isFinite(issuedAtMs) ||
    now.getTime() - issuedAtMs > OPENCLAW_ATTACHMENT_PROVENANCE_MAX_AGE_MS ||
    issuedAtMs - now.getTime() > 5 * 60 * 1000
  ) {
    return false;
  }

  return payloadMatchesAttachment(
    payload,
    canonicalizeOpenClawAttachment(input),
  );
}

function canonicalizeOpenClawAttachment(
  input: OpenClawAttachmentProvenanceInput,
): Omit<OpenClawAttachmentProvenancePayload, "version" | "issuedAt"> {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    threadId: input.threadId,
    bridgeDeviceId: input.bridgeDeviceId,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256 ?? null,
    kind: input.kind,
    storage: input.storage,
    localMediaRef: input.localMediaRef,
    createdAt: input.createdAt ?? null,
  };
}

function payloadMatchesAttachment(
  payload: OpenClawAttachmentProvenancePayload,
  attachment: Omit<OpenClawAttachmentProvenancePayload, "version" | "issuedAt">,
) {
  return (
    payload.id === attachment.id &&
    payload.workspaceId === attachment.workspaceId &&
    payload.threadId === attachment.threadId &&
    payload.bridgeDeviceId === attachment.bridgeDeviceId &&
    payload.filename === attachment.filename &&
    payload.mimeType === attachment.mimeType &&
    payload.sizeBytes === attachment.sizeBytes &&
    payload.sha256 === attachment.sha256 &&
    payload.kind === attachment.kind &&
    payload.storage === attachment.storage &&
    payload.localMediaRef === attachment.localMediaRef &&
    payload.createdAt === attachment.createdAt
  );
}

function encodePayload(payload: OpenClawAttachmentProvenancePayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(
  value: string,
): OpenClawAttachmentProvenancePayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<OpenClawAttachmentProvenancePayload>;
    if (
      typeof parsed !== "object" ||
      !parsed ||
      typeof parsed.version !== "string" ||
      typeof parsed.issuedAt !== "string"
    ) {
      return null;
    }
    return parsed as OpenClawAttachmentProvenancePayload;
  } catch {
    return null;
  }
}

function signPayload(payload: string, env: NodeJS.ProcessEnv) {
  return createHmac("sha256", resolveAttachmentProvenanceSecret(env))
    .update(payload)
    .digest("base64url");
}

function resolveAttachmentProvenanceSecret(env: NodeJS.ProcessEnv) {
  const configured = env.ATTACHMENT_PROVENANCE_SECRET?.trim();
  if (configured) return configured;

  if (shouldAssertProductionEnvironment(env)) {
    throw new Error(
      "ATTACHMENT_PROVENANCE_SECRET must be configured for production-like attachment provenance signing.",
    );
  }

  return DEV_ATTACHMENT_PROVENANCE_SECRET;
}

function safeEqual(a: string, b: string) {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  return aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes);
}
