import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type OlarkCredentials = { relayWebhookSecret: string };

export class OlarkWebhookError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class OlarkWebhookAdapter {
  health(credentials: OlarkCredentials) {
    this.secret(credentials);
    return {
      integration: "transcript_webhook",
      apiSurface: "webhook_and_browser_javascript",
    };
  }

  projectTranscript(credentials: OlarkCredentials, transcript: unknown) {
    this.secret(credentials);
    const item = this.record(transcript);
    const conversationId = this.identifier(item.id, "conversationId");
    const operators = Array.isArray(item.operators) ? item.operators : [];
    const groups = Array.isArray(item.groups) ? item.groups : [];
    const messages = Array.isArray(item.messages) ? item.messages : [];
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return {
      conversation: {
        conversationId,
        kind: this.optionalText(item.kind, 32),
        operatorCount: operators.length,
        groupCount: groups.length,
        messageCount: messages.length,
        tagCount: tags.length,
        startedAt: this.dateTime(item.started_at ?? item.startedAt),
        endedAt: this.dateTime(item.ended_at ?? item.endedAt),
      },
    };
  }

  private secret(credentials: OlarkCredentials) {
    const secret = credentials.relayWebhookSecret.trim();
    if (secret.length < 24)
      throw new OlarkWebhookError(
        "credential_missing",
        "Relay's Olark webhook secret is required.",
        401,
      );
    return secret;
  }
  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > 128 || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new OlarkWebhookError(
        "provider_validation_error",
        `Olark ${label} is invalid.`,
      );
    return text;
  }
  private optionalText(value: unknown, maximum: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maximum)
      : null;
  }
  private dateTime(value: unknown) {
    const text = typeof value === "string" ? value.trim().slice(0, 40) : "";
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private record(value: unknown): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new OlarkWebhookError(
        "provider_validation_error",
        "Olark transcript payload must be an object.",
      );
    const object = value as JsonObject;
    if (JSON.stringify(object).length > 1_000_000)
      throw new OlarkWebhookError(
        "provider_validation_error",
        "Olark transcript exceeds the 1 MB Relay boundary.",
      );
    return object;
  }
}
