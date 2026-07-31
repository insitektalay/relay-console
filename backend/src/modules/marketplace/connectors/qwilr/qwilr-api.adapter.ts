import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type QwilrCredentials = { accessToken: string };

export class QwilrApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class QwilrApiAdapter {
  private static readonly API_ORIGIN = "https://api.qwilr.com";

  async health(credentials: QwilrCredentials) {
    const value = await this.request(credentials, "GET", "/v1/blocks/saved");
    const blocks = this.array(value);
    return {
      credentialValid: true,
      savedBlocksVisible: blocks.length,
      providerRequestCount: 1,
      broadAccountToken: true,
      writesEnabled: false,
    };
  }

  async listSavedBlocks(credentials: QwilrCredentials, input: JsonObject) {
    const resultLimit = this.resultLimit(input.resultLimit);
    const value = await this.request(credentials, "GET", "/v1/blocks/saved");
    const blocks = this.array(value)
      .slice(0, resultLimit)
      .map((entry) => {
        const item = this.object(entry);
        return {
          blockId: this.scalar(item.id, 256),
          name: this.scalar(item.name, 500),
          type: this.scalar(item.type, 100),
        };
      });
    return {
      semanticReadContract: "qwilr-saved-block-list-v1",
      blocks,
      resultCount: blocks.length,
      maxResults: resultLimit,
      providerRequestCount: 1,
      blockContentReturned: false,
      substitutionsReturned: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  async getPage(credentials: QwilrCredentials, input: JsonObject) {
    const pageId = this.qwilrId(input.pageId, "pageId");
    const value = this.object(
      await this.request(
        credentials,
        "GET",
        `/v1/pages/${encodeURIComponent(pageId)}`,
      ),
    );
    return {
      semanticReadContract: "qwilr-page-get-v1",
      page: this.pageSummary(value),
      providerRequestCount: 1,
      contentReturned: false,
      peopleReturned: false,
      linksReturned: false,
      acceptanceReturned: false,
      paymentDataReturned: false,
      automaticRetries: false,
    };
  }

  async createPageDraft(credentials: QwilrCredentials, input: JsonObject) {
    const templateId = this.qwilrId(input.templateId, "templateId");
    const name = this.requiredString(input.name, "name", 200);
    const substitutions = this.substitutions(input.substitutions);
    const tags = this.tags(input.tags);
    const body = {
      templateId,
      name,
      published: false,
      substitutions,
      tags,
    };
    const encoded = JSON.stringify(body);
    if (Buffer.byteLength(encoded) > 150_000)
      throw this.validation("Qwilr draft input exceeded Relay's 150 KB bound.");
    const value = this.object(
      await this.request(credentials, "POST", "/v1/pages", encoded),
    );
    return {
      semanticWriteContract: "qwilr-page-draft-create-v1",
      page: this.pageSummary(value),
      substitutionCount: Object.keys(substitutions).length,
      tagCount: tags.length,
      published: false,
      providerRequestCount: 1,
      contentReturned: false,
      peopleReturned: false,
      linksReturned: false,
      acceptanceReturned: false,
      paymentDataReturned: false,
      rawProviderResponseReturned: false,
      automaticRetries: false,
    };
  }

  private async request(
    credentials: QwilrCredentials,
    method: "GET" | "POST",
    path: string,
    body?: string,
  ): Promise<unknown> {
    const token = this.accessToken(credentials);
    const url = new URL(path, `${QwilrApiAdapter.API_ORIGIN}/`);
    const allowed =
      (method === "GET" && url.pathname === "/v1/blocks/saved") ||
      (method === "GET" && /^\/v1\/pages\/[a-z0-9]{24}$/.test(url.pathname)) ||
      (method === "POST" && url.pathname === "/v1/pages");
    if (
      url.origin !== QwilrApiAdapter.API_ORIGIN ||
      url.search ||
      url.hash ||
      !allowed
    )
      throw new QwilrApiError(
        "policy_blocked",
        "Qwilr request escaped Relay's fixed route allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new QwilrApiError(
        "provider_unavailable",
        "Qwilr could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation("Qwilr response exceeded Relay's 1 MB bound.");
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Qwilr returned invalid JSON.");
    }
    if (!response.ok)
      throw new QwilrApiError(
        this.errorCode(response.status),
        "Qwilr rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private pageSummary(value: JsonObject) {
    return {
      pageId: this.scalar(value.id, 256),
      name: this.scalar(value.name, 500),
      status: this.scalar(value.status, 100),
      tags: this.stringArray(value.tags, 20, 100),
      createdAt: this.scalar(value.createdAt ?? value.created_at, 64),
      updatedAt: this.scalar(value.updatedAt ?? value.updated_at, 64),
    };
  }

  private accessToken(credentials: QwilrCredentials) {
    const token = credentials.accessToken?.trim();
    if (!token || token.length > 10_000)
      throw new QwilrApiError(
        "credential_missing",
        "Qwilr access token is missing.",
        401,
      );
    return token;
  }

  private resultLimit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("resultLimit must be an integer from 1 to 50.");
    return Number(value);
  }

  private qwilrId(value: unknown, name: string) {
    if (typeof value !== "string" || !/^[a-z0-9]{24}$/.test(value))
      throw this.validation(`${name} must be a 24-character Qwilr ID.`);
    return value;
  }

  private substitutions(value: unknown): Record<string, string> {
    if (value === undefined) return {};
    const object = this.object(value);
    const entries = Object.entries(object);
    if (entries.length > 50)
      throw this.validation("Qwilr drafts support at most 50 substitutions.");
    return Object.fromEntries(
      entries.map(([key, item]) => {
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key))
          throw this.validation("Qwilr substitution keys are invalid.");
        if (
          /(token|secret|password|cookie|authorization|credential|api.?key)/i.test(
            key,
          )
        )
          throw new QwilrApiError(
            "policy_blocked",
            "Credential-bearing Qwilr substitution keys are blocked.",
          );
        if (typeof item !== "string" || item.length > 5_000)
          throw this.validation(
            "Qwilr substitution values must be strings of at most 5000 characters.",
          );
        return [key, item];
      }),
    );
  }

  private tags(value: unknown) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 20)
      throw this.validation("Qwilr drafts support at most 20 tags.");
    const tags = value.map((entry) => this.requiredString(entry, "tag", 100));
    if (new Set(tags).size !== tags.length)
      throw this.validation("Qwilr tags must be unique.");
    return tags;
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(
        `${name} is required and must be at most ${max} characters.`,
      );
    return value.trim();
  }

  private stringArray(value: unknown, maxItems: number, maxLength: number) {
    return Array.isArray(value)
      ? value
          .slice(0, maxItems)
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.slice(0, maxLength))
      : [];
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new QwilrApiError("provider_validation_error", message);
  }
}
