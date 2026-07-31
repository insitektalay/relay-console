import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type JuroCredentials = { apiKey: string; apiOrigin: string };

export class JuroApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class JuroApiAdapter {
  private static readonly ORIGINS = new Set([
    "https://api.juro.com",
    "https://api-sandbox.juro.io",
  ]);

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: JuroCredentials) {
    const binding = this.binding(credentials);
    const value = this.object(await this.fetchJson(binding, "/v3/health"));
    if (value.message !== "ok")
      throw new JuroApiError(
        "connection_not_ready",
        "Juro health response did not confirm API access.",
        409,
      );
    return {
      credentialValid: true,
      environment: binding.origin.includes("sandbox")
        ? "sandbox"
        : "production",
      providerRequestCount: 1,
      broadAccountKey: true,
      writesEnabled: false,
    };
  }

  async listTemplates(credentials: JuroCredentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchJson(binding, "/v3/templates"));
    const templates = Array.isArray(value.templates) ? value.templates : [];
    return {
      semanticReadContract: "juro-template-list-v1",
      templates: templates
        .slice(0, limit)
        .map((entry) => this.templateSummary(this.object(entry))),
      returnedCount: Math.min(templates.length, limit),
      maxResults: limit,
      providerRequestCount: 1,
      linksReturned: false,
      fieldsReturned: false,
      questionsReturned: false,
      signingSidesReturned: false,
      approvalStateReturned: false,
      contractDataReturned: false,
      rawProviderResponseReturned: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  async getTemplate(credentials: JuroCredentials, input: JsonObject) {
    const binding = this.binding(credentials);
    const templateId = this.id(input.templateId);
    const value = this.object(
      await this.fetchJson(
        binding,
        `/v3/templates/${encodeURIComponent(templateId)}`,
      ),
    );
    return {
      semanticReadContract: "juro-template-get-v1",
      template: this.templateSummary(this.object(value.template), templateId),
      providerRequestCount: 1,
      linksReturned: false,
      fieldsReturned: false,
      questionsReturned: false,
      signingSidesReturned: false,
      approvalStateReturned: false,
      contractDataReturned: false,
      rawProviderResponseReturned: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchJson(
    binding: { origin: string; apiKey: string },
    path: string,
  ) {
    const url = new URL(path, `${binding.origin}/`);
    const allowed =
      url.pathname === "/v3/health" ||
      url.pathname === "/v3/templates" ||
      /^\/v3\/templates\/[A-Za-z0-9_-]{1,64}$/.test(url.pathname);
    if (url.origin !== binding.origin || url.search || url.hash || !allowed)
      throw new JuroApiError(
        "policy_blocked",
        "Juro request escaped Relay's fixed template-read route allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", "x-api-key": binding.apiKey },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new JuroApiError(
        "provider_unavailable",
        "Juro could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Juro response exceeded Relay's 1 MB bound.");
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Juro returned invalid JSON.");
    }
    if (!response.ok)
      throw new JuroApiError(
        this.errorCode(response.status),
        "Juro rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private binding(credentials: JuroCredentials) {
    const origin = credentials.apiOrigin?.trim().replace(/\/$/, "");
    const apiKey = credentials.apiKey?.trim();
    if (!JuroApiAdapter.ORIGINS.has(origin))
      throw new JuroApiError(
        "connection_not_ready",
        "Juro API origin must be the documented production or sandbox origin.",
      );
    if (!apiKey || apiKey.length > 10_000)
      throw new JuroApiError(
        "credential_missing",
        "Juro API key is missing.",
        401,
      );
    return { origin, apiKey };
  }

  private templateSummary(value: JsonObject, fallbackId?: string) {
    return {
      templateId: this.scalar(value.id, 64) ?? fallbackId ?? null,
      name: this.scalar(value.name, 200),
      status: this.scalar(value.status, 100),
      createdAt: this.scalar(value.createdDate, 100),
      updatedAt: this.scalar(value.updatedDate, 100),
    };
  }

  private limit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("limit must be an integer from 1 to 50.");
    return Number(value);
  }

  private id(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value))
      throw this.validation("templateId is invalid.");
    return value;
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
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new JuroApiError("provider_validation_error", message);
  }
}
