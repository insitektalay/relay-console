import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type IroncladCredentials = {
  apiOrigin: string;
  clientId: string;
  clientSecret: string;
  asUserId: string;
};

export class IroncladApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class IroncladApiAdapter {
  static readonly SCOPE = "public.workflows.readSchemas";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: IroncladCredentials) {
    const binding = this.binding(credentials);
    await this.accessToken(binding);
    return {
      credentialValid: true,
      environment: binding.origin,
      asUserId: binding.asUserId,
      exactScopes: [IroncladApiAdapter.SCOPE],
      providerRequestCount: 1,
      refreshTokensIssued: false,
      writesEnabled: false,
    };
  }

  async listWorkflowSchemas(
    credentials: IroncladCredentials,
    input: JsonObject,
  ) {
    const binding = this.binding(credentials);
    const limit = this.limit(input.limit);
    const token = await this.accessToken(binding);
    const value = await this.fetchJson(
      binding,
      token,
      "/public/api/v1/workflow-schemas?form=launch",
    );
    const root = this.object(value);
    const schemas = Array.isArray(value)
      ? value
      : Array.isArray(root.list)
        ? root.list
        : Array.isArray(root.schemas)
          ? root.schemas
          : [];
    return {
      semanticReadContract: "ironclad-workflow-schema-list-v1",
      schemas: schemas.slice(0, limit).map((entry) => {
        const schema = this.object(entry);
        return {
          templateId:
            this.scalar(schema.id, 128) ?? this.scalar(schema.templateId, 128),
          name: this.scalar(schema.name, 200),
        };
      }),
      returnedCount: Math.min(schemas.length, limit),
      maxResults: limit,
      exactScopes: [IroncladApiAdapter.SCOPE],
      asUserId: binding.asUserId,
      providerRequestCount: 2,
      schemaFieldsReturned: false,
      workflowDataReturned: false,
      contractDataReturned: false,
      peopleReturned: false,
      documentsReturned: false,
      rawProviderResponseReturned: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async accessToken(binding: {
    origin: string;
    clientId: string;
    clientSecret: string;
    asUserId: string;
  }) {
    const url = new URL("/oauth/token", `${binding.origin}/`);
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${binding.clientId}:${binding.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: IroncladApiAdapter.SCOPE,
        }).toString(),
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new IroncladApiError(
        "provider_unavailable",
        "Ironclad token service could not be reached.",
        502,
      );
    }
    const value = this.object(await this.responseJson(response));
    if (!response.ok)
      throw new IroncladApiError(
        this.errorCode(response.status),
        "Ironclad rejected the exact-scope client credential exchange.",
        response.status,
      );
    const accessToken = this.requiredString(
      value.access_token,
      "access token",
      20_000,
    );
    const scopes = this.requiredString(value.scope, "granted scope", 1_000)
      .split(/\s+/)
      .filter(Boolean);
    if (scopes.length !== 1 || scopes[0] !== IroncladApiAdapter.SCOPE)
      throw new IroncladApiError(
        "insufficient_scope",
        "Ironclad did not return the exact workflow-schema read scope.",
        403,
      );
    return accessToken;
  }

  private async fetchJson(
    binding: { origin: string; asUserId: string },
    token: string,
    path: string,
  ) {
    const url = new URL(path, `${binding.origin}/`);
    if (
      url.origin !== binding.origin ||
      url.pathname !== "/public/api/v1/workflow-schemas" ||
      url.search !== "?form=launch" ||
      url.hash
    )
      throw new IroncladApiError(
        "policy_blocked",
        "Ironclad request escaped Relay's fixed workflow-schema route.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "x-as-user-id": binding.asUserId,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new IroncladApiError(
        "provider_unavailable",
        "Ironclad could not be reached.",
        502,
      );
    }
    const value = await this.responseJson(response);
    if (!response.ok)
      throw new IroncladApiError(
        this.errorCode(response.status),
        "Ironclad rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private async responseJson(response: Response) {
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Ironclad response exceeded Relay's 1 MB bound.");
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Ironclad returned invalid JSON.");
    }
  }

  private binding(credentials: IroncladCredentials) {
    const rawOrigin = credentials.apiOrigin?.trim().replace(/\/$/, "");
    let url: URL;
    try {
      url = new URL(rawOrigin);
    } catch {
      throw new IroncladApiError(
        "connection_not_ready",
        "Ironclad API origin is invalid.",
      );
    }
    if (
      url.protocol !== "https:" ||
      !/^[a-z0-9-]+\.ironcladapp\.com$/.test(url.hostname) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password ||
      url.port
    )
      throw new IroncladApiError(
        "connection_not_ready",
        "Ironclad API origin must be an exact HTTPS Ironclad environment origin.",
      );
    const clientId = this.requiredString(
      credentials.clientId,
      "client ID",
      1_000,
    );
    const clientSecret = this.requiredString(
      credentials.clientSecret,
      "client secret",
      10_000,
    );
    const asUserId = this.requiredString(
      credentials.asUserId,
      "as-user ID",
      128,
    );
    if (!/^[A-Za-z0-9_-]+$/.test(asUserId))
      throw this.validation("Ironclad as-user ID is invalid.");
    return { origin: url.origin, clientId, clientSecret, asUserId };
  }

  private limit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("limit must be an integer from 1 to 50.");
    return Number(value);
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is missing or invalid.`);
    return value.trim();
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown, max: number) {
    if (typeof value === "string" && value) return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    return null;
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 400 || status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new IroncladApiError("provider_validation_error", message);
  }
}
