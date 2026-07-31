export const CONDENSED_MESSAGE_PROVIDER = "runtime_structured_summary_v1";

export type CondensedLineCountHint = 1 | 2;

export interface CondensedMessageMetadata {
  text: string;
  lineCountHint?: CondensedLineCountHint | null;
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

  const lineCountHint = normalizeLineCountHint(candidate.lineCountHint);

  return {
    text,
    lineCountHint,
    generatedAt,
    provider,
    sourceContentHash,
  };
}

export function withCondensedMessageMetadata(
  metadata: Record<string, unknown> | null | undefined,
  condensed: CondensedMessageMetadata | null,
) {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...metadata }
      : {};

  if (!condensed) {
    delete (base as Record<string, unknown>).condensed;
    return Object.keys(base).length ? base : null;
  }

  return {
    ...base,
    condensed: {
      text: condensed.text,
      lineCountHint: normalizeLineCountHint(condensed.lineCountHint),
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

export function buildCondensedFallbackPreview(value: string, maxLength = 160) {
  const plainText = stripMarkdownToPlainText(value);
  if (!plainText) {
    return "(No message content)";
  }

  const sentenceMatch = plainText.match(/^(.{1,220}?[.!?])(?:\s|$)/);
  const preferred =
    sentenceMatch?.[1] && sentenceMatch[1].length <= maxLength
      ? sentenceMatch[1]
      : plainText;

  return truncatePlainText(preferred, maxLength);
}

export function inferCondensedLineCountHint(
  text: string,
): CondensedLineCountHint {
  const normalized = stripMarkdownToPlainText(text);
  return normalized.length > 96 ? 2 : 1;
}

function normalizeLineCountHint(value: unknown): CondensedLineCountHint | null {
  return value === 2 ? 2 : value === 1 ? 1 : null;
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
