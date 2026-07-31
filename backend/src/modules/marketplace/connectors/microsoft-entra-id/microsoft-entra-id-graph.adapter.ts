import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export const MICROSOFT_ENTRA_ID_OPERATIONS = ["identity.get"] as const;

export class MicrosoftEntraIdGraphError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class MicrosoftEntraIdGraphAdapter {
  health(accessToken: string) {
    return this.read(accessToken, "identity.get");
  }

  read(accessToken: string, operation: string) {
    if (!MICROSOFT_ENTRA_ID_OPERATIONS.includes(operation as never))
      throw new MicrosoftEntraIdGraphError(
        "policy_blocked",
        "Microsoft Entra ID operation is outside Relay's pinned signed-in identity contract.",
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
      throw new MicrosoftEntraIdGraphError(
        "credential_missing",
        "A valid Microsoft access token is required.",
        401,
      );
    const url = new URL("https://graph.microsoft.com/v1.0/me");
    url.searchParams.set(
      "$select",
      "id,displayName,userPrincipalName,userType",
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new MicrosoftEntraIdGraphError(
        "provider_unavailable",
        "Microsoft Entra ID could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 100_000)
      throw new MicrosoftEntraIdGraphError(
        "provider_validation_error",
        "Microsoft Entra ID response exceeds Relay's 100 KB limit.",
        400,
      );
    const data = this.parse(raw);
    if (!response.ok)
      throw new MicrosoftEntraIdGraphError(
        this.safeCode(response.status),
        this.errorMessage(data) ??
          `Microsoft Entra ID returned HTTP ${response.status}.`,
        response.status,
      );
    const body = this.object(data);
    const id = this.guid(body.id);
    if (!id)
      throw new MicrosoftEntraIdGraphError(
        "provider_validation_error",
        "Microsoft Entra ID returned an invalid signed-in user.",
        502,
      );
    return {
      id,
      displayName: this.string(body.displayName, 250),
      userPrincipalName: this.string(body.userPrincipalName, 320),
      userType: this.string(body.userType, 32),
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
    const nested = this.object(body.error);
    const candidate = nested.message ?? body.message;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private guid(value: unknown) {
    return typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
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
