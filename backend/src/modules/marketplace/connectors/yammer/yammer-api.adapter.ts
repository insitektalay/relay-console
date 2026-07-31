import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const YAMMER_OPERATIONS = ["identity.get"] as const;

export class YammerApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class YammerApiAdapter {
  health(accessToken: string) {
    return this.read(accessToken, "identity.get");
  }

  read(accessToken: string, operation: string) {
    if (!YAMMER_OPERATIONS.includes(operation as never))
      throw new YammerApiError(
        "policy_blocked",
        "Yammer operation is outside Relay's pinned signed-in identity contract.",
        403,
      );
    return this.identity(accessToken);
  }

  private async identity(accessToken: string) {
    if (
      !accessToken ||
      accessToken.length > 32_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new YammerApiError(
        "credential_missing",
        "A valid Microsoft access token is required.",
        401,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(
        "https://www.yammer.com/api/v1/users/current.json",
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
      throw new YammerApiError(
        "provider_unavailable",
        "Yammer could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 100_000)
      throw new YammerApiError(
        "provider_validation_error",
        "Yammer response exceeds Relay's 100 KB limit.",
        400,
      );
    const data = this.parse(raw);
    if (!response.ok)
      throw new YammerApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Yammer returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    const id = this.identifier(body.id);
    if (!id)
      throw new YammerApiError(
        "provider_validation_error",
        "Yammer returned an invalid signed-in user.",
        502,
      );
    return {
      id,
      fullName: this.string(body.full_name, 250),
      email: this.string(body.email, 320),
      networkId: this.identifier(body.network_id),
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
    const response = this.object(body.response);
    const candidate = response.message ?? body.message ?? body.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private identifier(value: unknown) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      return String(value);
    return typeof value === "string" && /^[1-9][0-9]{0,30}$/.test(value)
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
