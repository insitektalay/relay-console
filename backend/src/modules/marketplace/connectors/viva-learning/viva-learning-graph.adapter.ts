import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const VIVA_LEARNING_OPERATIONS = ["providers.list"] as const;

export class VivaLearningGraphError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class VivaLearningGraphAdapter {
  health(accessToken: string) {
    return this.read(accessToken, "providers.list");
  }

  async read(accessToken: string, operation: string) {
    if (!VIVA_LEARNING_OPERATIONS.includes(operation as never))
      throw new VivaLearningGraphError(
        "policy_blocked",
        "Viva Learning operation is outside Relay's pinned provider-directory contract.",
        403,
      );
    if (
      !accessToken ||
      accessToken.length > 32_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new VivaLearningGraphError(
        "credential_missing",
        "A valid Microsoft access token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(
        "https://graph.microsoft.com/v1.0/employeeExperience/learningProviders?$select=id,displayName,isCourseActivitySyncEnabled&$top=50",
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
      );
    } catch {
      throw new VivaLearningGraphError(
        "provider_unavailable",
        "Microsoft Graph could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 250_000)
      throw new VivaLearningGraphError(
        "provider_validation_error",
        "Viva Learning response exceeds Relay's 250 KB limit.",
        400,
      );
    const data = this.parse(raw);
    if (!response.ok)
      throw new VivaLearningGraphError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Microsoft Graph returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    const values = Array.isArray(body.value) ? body.value.slice(0, 50) : null;
    if (!values)
      throw new VivaLearningGraphError(
        "provider_validation_error",
        "Viva Learning returned an invalid provider directory.",
        502,
      );
    return {
      providers: values
        .map((item) => this.object(item))
        .map((item) => ({
          id: this.identifier(item.id),
          displayName: this.string(item.displayName, 250),
          isCourseActivitySyncEnabled:
            typeof item.isCourseActivitySyncEnabled === "boolean"
              ? item.isCourseActivitySyncEnabled
              : null,
        }))
        .filter((item) => item.id),
      truncated: typeof body["@odata.nextLink"] === "string",
    };
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401 || status === 403) return "credential_missing";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    const body = this.object(value);
    const error = this.object(body.error);
    const candidate = error.message ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private identifier(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9._:-]{1,200}$/.test(value)
      ? value
      : null;
  }

  private string(value: unknown, maxLength: number) {
    return typeof value === "string" ? value.slice(0, maxLength) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
