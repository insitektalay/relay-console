import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  TWILIO_SEGMENT_ENGAGE_OPERATION_BY_ID,
  type TwilioSegmentEngageOperation,
} from "./twilio-segment-engage-operation-registry";

type JsonObject = Record<string, unknown>;
export type TwilioSegmentEngageCredentials = {
  apiToken: string;
  region: string;
  healthSpaceId: string;
};
export type TwilioSegmentEngageInput = {
  spaceId?: unknown;
  audienceId?: unknown;
};

@Injectable()
export class TwilioSegmentEngageApiAdapter {
  private static readonly ORIGINS: Record<string, string> = {
    us: "https://api.segmentapis.com",
    eu: "https://eu1.api.segmentapis.com",
  };

  health(credentials: TwilioSegmentEngageCredentials) {
    return this.read(credentials, "get_space", {
      spaceId: credentials.healthSpaceId,
    });
  }

  read(
    credentials: TwilioSegmentEngageCredentials,
    operationId: string,
    input: TwilioSegmentEngageInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: TwilioSegmentEngageCredentials,
    operation: TwilioSegmentEngageOperation,
    input: TwilioSegmentEngageInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path.replace(
      "{spaceId}",
      this.identifier(input.spaceId, "spaceId"),
    );
    if (path.includes("{audienceId}"))
      path = path.replace(
        "{audienceId}",
        this.identifier(input.audienceId, "audienceId"),
      );
    else if (input.audienceId !== undefined)
      throw this.validation(
        "Twilio Segment Engage audienceId is accepted only for exact audience reads.",
      );
    const token = credentials.apiToken.trim();
    const origin =
      TwilioSegmentEngageApiAdapter.ORIGINS[
        credentials.region.trim().toLowerCase()
      ];
    if (!token || token.length > 20_000 || !origin)
      throw new TwilioSegmentEngageApiError(
        "credential_missing",
        "Twilio Segment Engage API token or region is missing.",
      );
    try {
      const response = await safeConnectorFetch(new URL(path, origin), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Twilio Segment Engage response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new TwilioSegmentEngageApiError(
          this.safeCode(response.status),
          `Twilio Segment Engage returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        data: this.redact(data),
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof TwilioSegmentEngageApiError) throw error;
      throw new TwilioSegmentEngageApiError(
        "provider_unavailable",
        "Twilio Segment Engage could not be reached.",
      );
    }
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9_-]{1,255}$/.test(text))
      throw this.validation(`Twilio Segment Engage ${label} is invalid.`);
    return encodeURIComponent(text);
  }

  private operation(id: string) {
    const operation = TWILIO_SEGMENT_ENGAGE_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new TwilioSegmentEngageApiError(
        "tool_unavailable",
        "Twilio Segment Engage operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: TwilioSegmentEngageInput) {
    for (const key of Object.keys(value))
      if (
        /(api.?token|access.?token|authorization|cookie|url|uri|endpoint|origin|region)/i.test(
          key,
        )
      )
        throw new TwilioSegmentEngageApiError(
          "policy_blocked",
          "Credential or routing Twilio Segment Engage input fields are blocked.",
        );
  }

  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("Twilio Segment Engage returned invalid JSON.");
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value))
      return value.slice(0, 200).map((entry) => this.redact(entry));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, child]) => [
          key,
          /(api.?token|access.?token|authorization|cookie)/i.test(key)
            ? "[REDACTED]"
            : this.redact(child),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new TwilioSegmentEngageApiError(
      "provider_validation_error",
      message,
    );
  }
}

export class TwilioSegmentEngageApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
