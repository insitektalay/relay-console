import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type LedgyCredentials = { apiKey: string };
export const LEDGY_OPERATIONS = ["auth.company"] as const;
const AUTH_QUERY = `query RelayAuth {
  auth {
    companyId
    companyName
  }
}`;

export class LedgyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

@Injectable()
export class LedgyApiAdapter {
  private readonly endpoint = "https://app.ledgy.com/graphql";

  async health(credentials: LedgyCredentials) {
    const result = await this.read(credentials, { operation: "auth.company" });
    return {
      endpoint: this.endpoint,
      companyIdentityVerified: true,
      companyId: result.company.id,
    };
  }

  async read(credentials: LedgyCredentials, input: JsonObject) {
    if (input.operation !== "auth.company")
      throw new LedgyApiError(
        "policy_blocked",
        "Ledgy operation is outside Relay's pinned company-identity query.",
        403,
      );
    const apiKey = this.credential(credentials.apiKey);
    let response: Response;
    try {
      response = await safeConnectorFetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: AUTH_QUERY,
          variables: {},
          operationName: "RelayAuth",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new LedgyApiError(
        "provider_unavailable",
        "Ledgy API could not be reached.",
        502,
      );
    }
    const body = await this.body(response);
    if (!response.ok) throw this.httpError(response.status);
    if (Array.isArray(body.errors) && body.errors.length)
      throw new LedgyApiError(
        "provider_validation_error",
        "Ledgy rejected the bounded company-identity query.",
        502,
      );
    const auth = this.object(this.object(body.data).auth);
    const id = this.id(auth.companyId);
    const name = this.text(auth.companyName, 1_000);
    if (!id || !name)
      throw new LedgyApiError(
        "provider_validation_error",
        "Ledgy returned an invalid company identity.",
        502,
      );
    return { company: { id, name } };
  }

  private credential(value: string) {
    if (!value || value.length > 4_000 || /[\r\n]/.test(value))
      throw new LedgyApiError(
        "credential_missing",
        "A valid Ledgy API key is required.",
        401,
      );
    return value;
  }

  private httpError(status: number) {
    return new LedgyApiError(
      status === 429
        ? "provider_rate_limited"
        : status >= 500
          ? "provider_unavailable"
          : status === 401 || status === 403
            ? "credential_missing"
            : "provider_validation_error",
      `Ledgy returned HTTP ${status}.`,
      status || 400,
    );
  }

  private async body(response: Response) {
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 100_000)
      throw new LedgyApiError(
        "provider_validation_error",
        "Ledgy response exceeds Relay's size limit.",
      );
    try {
      return this.object(JSON.parse(raw.toString("utf8")));
    } catch {
      return {};
    }
  }

  private id(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value)
      ? value
      : null;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" && value.length > 0
      ? value.slice(0, max)
      : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
