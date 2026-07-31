import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type ConcordCredentials = {
  apiKey: string;
  apiOrigin: string;
  organizationId: string;
};

export class ConcordApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ConcordApiAdapter {
  private static readonly ORIGINS = new Set([
    "https://api.concordnow.com",
    "https://uat.concordnow.com",
  ]);

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ConcordCredentials) {
    const binding = this.binding(credentials);
    const value = this.object(await this.fetchJson(binding, "GET", "/user/me"));
    const currentOrganizationId = this.integer(value.currentOrganizationId);
    if (currentOrganizationId !== binding.organizationId)
      throw new ConcordApiError(
        "connection_not_ready",
        "Concord API key is not bound to the configured organization.",
        409,
      );
    return {
      credentialValid: true,
      environment: binding.origin.endsWith("uat.concordnow.com")
        ? "sandbox"
        : "production",
      organizationId: String(binding.organizationId),
      providerRequestCount: 1,
      broadOrganizationKey: true,
      writesEnabled: false,
    };
  }

  async getAgreementMetadata(
    credentials: ConcordCredentials,
    input: JsonObject,
  ) {
    const binding = this.binding(credentials);
    const agreementUid = this.uid(input.agreementUid);
    const value = this.object(
      await this.fetchJson(
        binding,
        "GET",
        `/organizations/${binding.organizationId}/agreements/${encodeURIComponent(agreementUid)}/metadata`,
      ),
    );
    const source = this.object(value.source);
    return {
      semanticReadContract: "concord-agreement-metadata-get-v1",
      agreement: {
        agreementUid,
        title: this.scalar(value.title, 127),
        status: this.scalar(value.status, 100),
        read: this.boolean(value.read),
        inboxed: this.boolean(value.inboxed),
        bookmarked: this.boolean(value.bookmarked),
        trashed: this.boolean(value.trashed),
        lastAccessAt: this.integer(value.lastAccessAt),
        tags: this.tagNames(value.tags),
        fromTemplate: this.boolean(source.fromTemplate),
      },
      organizationId: String(binding.organizationId),
      providerRequestCount: 1,
      descriptionReturned: false,
      contentReturned: false,
      peopleReturned: false,
      signaturesReturned: false,
      financialDataReturned: false,
      linksReturned: false,
      rawProviderResponseReturned: false,
      automaticRetries: false,
    };
  }

  async createAgreementDraft(
    credentials: ConcordCredentials,
    input: JsonObject,
  ) {
    const binding = this.binding(credentials);
    const title = this.requiredString(input.title, "title", 127);
    const description = this.optionalString(
      input.description,
      "description",
      1_024,
    );
    const tags = this.inputTags(input.tags);
    const body = JSON.stringify({
      status: "DRAFT",
      parametersSource: "NONE",
      title,
      ...(description === null ? {} : { description }),
      tags,
    });
    if (Buffer.byteLength(body) > 100_000)
      throw this.validation(
        "Concord draft input exceeded Relay's 100 KB bound.",
      );
    const value = this.object(
      await this.fetchJson(
        binding,
        "POST",
        `/organizations/${binding.organizationId}/agreements`,
        body,
      ),
    );
    return {
      semanticWriteContract: "concord-agreement-draft-create-v1",
      agreement: {
        agreementUid: this.scalar(value.uid, 64),
        agreementId: this.scalar(value.id, 128),
        title,
        status: "DRAFT",
      },
      organizationId: String(binding.organizationId),
      tagCount: tags.length,
      providerRequestCount: 1,
      sent: false,
      shared: false,
      signingStarted: false,
      rawProviderResponseReturned: false,
      automaticRetries: false,
    };
  }

  private async fetchJson(
    binding: { origin: string; organizationId: number; apiKey: string },
    method: "GET" | "POST",
    path: string,
    body?: string,
  ) {
    const url = new URL(`/api/rest/1${path}`, `${binding.origin}/`);
    const org = String(binding.organizationId);
    const allowed =
      (method === "GET" && url.pathname === "/api/rest/1/user/me") ||
      (method === "GET" &&
        new RegExp(
          `^/api/rest/1/organizations/${org}/agreements/[A-Za-z0-9_-]{1,64}/metadata$`,
        ).test(url.pathname)) ||
      (method === "POST" &&
        url.pathname === `/api/rest/1/organizations/${org}/agreements`);
    if (url.origin !== binding.origin || url.search || url.hash || !allowed)
      throw new ConcordApiError(
        "policy_blocked",
        "Concord request escaped Relay's fixed organization route allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method,
        headers: {
          Accept: "application/json",
          "X-API-KEY": binding.apiKey,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new ConcordApiError(
        "provider_unavailable",
        "Concord could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Concord response exceeded Relay's 1 MB bound.");
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Concord returned invalid JSON.");
    }
    if (!response.ok)
      throw new ConcordApiError(
        this.errorCode(response.status),
        "Concord rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private binding(credentials: ConcordCredentials) {
    const origin = credentials.apiOrigin?.trim().replace(/\/$/, "");
    const organizationId = this.positiveInteger(credentials.organizationId);
    const apiKey = credentials.apiKey?.trim();
    if (!ConcordApiAdapter.ORIGINS.has(origin))
      throw new ConcordApiError(
        "connection_not_ready",
        "Concord API origin must be the documented production or UAT origin.",
      );
    if (!apiKey || apiKey.length > 10_000)
      throw new ConcordApiError(
        "credential_missing",
        "Concord API key is missing.",
        401,
      );
    return { origin, organizationId, apiKey };
  }

  private positiveInteger(value: unknown) {
    const normalized = typeof value === "string" ? Number(value) : value;
    if (
      !Number.isSafeInteger(normalized) ||
      Number(normalized) < 1 ||
      Number(normalized) > 9_007_199_254_740_991
    )
      throw this.validation("organizationId must be a positive integer.");
    return Number(normalized);
  }

  private uid(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(value))
      throw this.validation("agreementUid is invalid.");
    return value;
  }

  private inputTags(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 20)
      throw this.validation("Concord drafts support at most 20 tags.");
    const tags = value.map((item) => this.requiredString(item, "tag", 100));
    if (new Set(tags).size !== tags.length)
      throw this.validation("Concord tags must be unique.");
    return tags;
  }

  private tagNames(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, 20).flatMap((entry) => {
      const name = this.scalar(this.object(entry).name, 100);
      return name ? [name] : [];
    });
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(
        `${name} is required and must be at most ${max} characters.`,
      );
    return value.trim();
  }

  private optionalString(value: unknown, name: string, max: number) {
    if (value === undefined) return null;
    return this.requiredString(value, name, max);
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

  private integer(value: unknown) {
    return Number.isSafeInteger(value) ? Number(value) : null;
  }

  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : null;
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
    return new ConcordApiError("provider_validation_error", message);
  }
}
