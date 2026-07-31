export const CONDENSED_MESSAGE_PROVIDER = "runtime_structured_summary_v1";
export const MESSAGE_CONDENSING_QUEUE = "message-condensing";
export const CONDENSE_MESSAGE_JOB = "condense-agent-message";

export interface CondensedMessageMetadata {
  text: string;
  lineCountHint?: 1 | 2 | null;
  generatedAt: string;
  provider: string;
  sourceContentHash: string;
}

export interface MessageCondensedUpdatedPayload {
  threadId: string;
  messageId: string;
  condensed: CondensedMessageMetadata;
  updatedAt: string;
}

export function getCondensedMessageMetadata(
  metadata?: Record<string, unknown> | null,
): CondensedMessageMetadata | null {
  const condensed = metadata?.condensed;
  if (!condensed || typeof condensed !== "object" || Array.isArray(condensed)) {
    return null;
  }

  const candidate = condensed as Record<string, unknown>;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const generatedAt =
    typeof candidate.generatedAt === "string"
      ? candidate.generatedAt.trim()
      : "";
  const provider =
    typeof candidate.provider === "string" ? candidate.provider.trim() : "";
  const sourceContentHash =
    typeof candidate.sourceContentHash === "string"
      ? candidate.sourceContentHash.trim()
      : "";

  if (!text || !generatedAt || !provider || !sourceContentHash) {
    return null;
  }

  return {
    text,
    lineCountHint:
      candidate.lineCountHint === 2
        ? 2
        : candidate.lineCountHint === 1
          ? 1
          : null,
    generatedAt,
    provider,
    sourceContentHash,
  };
}

export function withCondensedMessageMetadata(
  metadata: Record<string, unknown> | null | undefined,
  condensed: CondensedMessageMetadata,
) {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  return {
    ...base,
    condensed: {
      text: condensed.text,
      lineCountHint: condensed.lineCountHint ?? null,
      generatedAt: condensed.generatedAt,
      provider: condensed.provider,
      sourceContentHash: condensed.sourceContentHash,
    },
  };
}

export function stripMarkdownToPlainText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\|/g, " ")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeCondensedMessageText(value: string, maxLength = 180) {
  return truncatePlainText(stripMarkdownToPlainText(value), maxLength);
}

export function inferCondensedLineCountHint(text: string): 1 | 2 {
  return stripMarkdownToPlainText(text).length > 96 ? 2 : 1;
}

function truncatePlainText(value: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, Math.max(0, maxLength - 1));
  const lastSpaceIndex = truncated.lastIndexOf(" ");
  const safeText =
    lastSpaceIndex > Math.floor(maxLength * 0.6)
      ? truncated.slice(0, lastSpaceIndex)
      : truncated;

  return `${safeText.trimEnd()}…`;
}
