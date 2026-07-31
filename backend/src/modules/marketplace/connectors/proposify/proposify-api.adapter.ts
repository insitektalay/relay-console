import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type ProposifyCredentials = { clientId: string; clientSecret: string };

export class ProposifyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ProposifyApiAdapter {
  private static readonly ORIGIN = "https://connect.proposify.com";
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ProposifyCredentials) {
    await this.accessToken(credentials);
    return {
      clientCredentialsVerified: true,
      exactScopes: ["read_documents"],
      providerRequestCount: 1,
      refreshTokensUsed: false,
      writesEnabled: false,
    };
  }

  async getDocument(credentials: ProposifyCredentials, input: JsonObject) {
    const documentId = this.uuid(input.documentId);
    const token = await this.accessToken(credentials);
    const value = this.object(
      await this.fetchJson(
        `${ProposifyApiAdapter.ORIGIN}/v3/document/${encodeURIComponent(documentId)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          redirect: "error",
          signal: AbortSignal.timeout(30_000),
          cache: "no-store",
        },
        1_000_000,
      ),
    );
    return {
      semanticReadContract: "proposify-v3-document-get-v1",
      document: {
        documentId: this.scalar(value.id, 64),
        name: this.scalar(value.name, 500),
        status: this.scalar(value.status, 100),
        locked: typeof value.is_locked === "boolean" ? value.is_locked : null,
        createdAt: this.scalar(value.created_at, 64),
        updatedAt: this.scalar(value.updated_at, 64),
      },
      exactScopes: ["read_documents"],
      providerRequestCount: 2,
      peopleReturned: false,
      contentReturned: false,
      clientDataReturned: false,
      signingDataReturned: false,
      linksReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async accessToken(credentials: ProposifyCredentials) {
    this.requireCredentials(credentials);
    const key = createHash("sha256")
      .update(`${credentials.clientId}\0${credentials.clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 30_000)
      return cached.accessToken;
    const basic = Buffer.from(
      `${credentials.clientId}:${credentials.clientSecret}`,
      "utf8",
    ).toString("base64");
    const value = this.object(
      await this.fetchJson(
        `${ProposifyApiAdapter.ORIGIN}/oauth/token`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "read_documents",
          }).toString(),
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
          cache: "no-store",
        },
        64_000,
      ),
    );
    const accessToken = this.string(value.access_token);
    const tokenType = this.string(value.token_type)?.toLowerCase();
    const expiresIn = this.number(value.expires_in);
    if (!accessToken || tokenType !== "bearer" || !expiresIn || expiresIn < 1)
      throw new ProposifyApiError(
        "token_refresh_failed",
        "Proposify did not return a usable short-lived Bearer token.",
      );
    this.tokens.set(key, {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 3_600) * 1_000,
    });
    return accessToken;
  }

  private async fetchJson(url: string, init: RequestInit, maxBytes: number) {
    const parsedUrl = new URL(url);
    const allowed =
      (parsedUrl.pathname === "/oauth/token" && init.method === "POST") ||
      (/^\/v3\/document\/[0-9a-fA-F-]{36}$/.test(parsedUrl.pathname) &&
        init.method === "GET");
    if (
      parsedUrl.origin !== ProposifyApiAdapter.ORIGIN ||
      parsedUrl.search ||
      parsedUrl.hash ||
      !allowed
    )
      throw new ProposifyApiError(
        "policy_blocked",
        "Proposify request escaped Relay's fixed read-only route allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url, init);
    } catch {
      throw new ProposifyApiError(
        "provider_unavailable",
        "Proposify could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > maxBytes)
      throw this.validation("Proposify response exceeded Relay's size bound.");
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Proposify returned invalid JSON.");
    }
    if (!response.ok)
      throw new ProposifyApiError(
        this.errorCode(response.status),
        "Proposify rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private requireCredentials(value: ProposifyCredentials) {
    if (
      !/^[0-9a-zA-Z.-]{1,500}$/.test(value.clientId) ||
      !value.clientSecret ||
      value.clientSecret.length > 2_000
    )
      throw new ProposifyApiError(
        "credential_missing",
        "Proposify client credentials are missing or invalid.",
        401,
      );
  }

  private uuid(value: unknown) {
    if (
      typeof value !== "string" ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
        value,
      )
    )
      throw this.validation("documentId must be a valid UUID.");
    return value;
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }

  private string(value: unknown) {
    return typeof value === "string" && value ? value : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new ProposifyApiError("provider_validation_error", message);
  }
}
