import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type UpLeadCredentials = { apiKey: string };

export class UpLeadApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class UpLeadApiAdapter {
  private readonly endpoint = "https://api.uplead.com/v2/credits";
  private readonly maxResponseBytes = 64 * 1024;

  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: UpLeadCredentials) {
    const usage = await this.getCreditBalance(credentials);
    return {
      apiEndpoint: this.endpoint,
      apiKeyValidated: true,
      remainingCredits: usage.remainingCredits,
    };
  }

  async getCreditBalance(credentials: UpLeadCredentials) {
    const root = this.object(
      await this.request(this.credential(credentials?.apiKey)),
      "response",
    );
    const data = this.object(root.data, "data");
    return {
      remainingCredits: this.nonNegativeInteger(data.credits, "data.credits"),
    };
  }

  private async request(apiKey: string) {
    let response: Response;
    try {
      response = await this.requester(this.endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: apiKey,
          "User-Agent": "RelayConsole-UpLead/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        cache: "no-store",
      });
    } catch {
      throw new UpLeadApiError(
        "provider_unavailable",
        "UpLead could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new UpLeadApiError(
        this.errorCode(response.status),
        `UpLead returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private credential(value: unknown) {
    const apiKey = typeof value === "string" ? value.trim() : "";
    if (
      apiKey.length < 16 ||
      apiKey.length > 1024 ||
      /[\s\u0000-\u001f\u007f]/.test(apiKey)
    )
      throw new UpLeadApiError(
        "credential_missing",
        "A valid customer-owned UpLead API key is required",
        401,
      );
    return apiKey;
  }

  private object(value: unknown, field: string): JsonObject {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw this.invalid(`UpLead returned invalid ${field}`);
    return value as JsonObject;
  }

  private nonNegativeInteger(value: unknown, field: string) {
    if (!Number.isSafeInteger(value) || (value as number) < 0)
      throw this.invalid(`UpLead returned invalid ${field}`);
    return value as number;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid("UpLead response exceeded the allowed size");
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new UpLeadApiError(
        "provider_unavailable",
        "UpLead response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid("UpLead response exceeded the allowed size");
    if (!bytes.byteLength)
      throw this.invalid("UpLead returned an empty response");
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok) throw this.invalid("UpLead returned invalid JSON");
      return {};
    }
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 402 || status === 429) return "provider_rate_limited";
    if (status === 403 || status === 451) return "insufficient_scope";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private invalid(message: string) {
    return new UpLeadApiError("provider_validation_error", message, 400);
  }
}
