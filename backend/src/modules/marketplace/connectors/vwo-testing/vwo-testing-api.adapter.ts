import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  VWO_TESTING_OPERATION_BY_ID,
  type VwoTestingOperation,
} from "./vwo-testing-operation-registry";

type JsonObject = Record<string, unknown>;
export type VwoTestingCredentials = {
  personalApiToken: string;
  accountId: string;
};
export type VwoTestingInput = { resourceId?: unknown };

@Injectable()
export class VwoTestingApiAdapter {
  private static readonly ORIGIN = "https://app.vwo.com";

  health(credentials: VwoTestingCredentials) {
    return this.read(credentials, "list_feature_flags", {});
  }

  read(
    credentials: VwoTestingCredentials,
    operationId: string,
    input: VwoTestingInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: VwoTestingCredentials,
    operation: VwoTestingOperation,
    input: VwoTestingInput,
  ) {
    this.rejectInput(input);
    const accountId = this.positiveInteger(credentials.accountId, "accountId");
    let path = operation.path.replace("{accountId}", accountId);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        encodeURIComponent(this.identifier(input.resourceId, "resourceId")),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "VWO Testing resourceId is accepted only for exact reads.",
      );
    const token = credentials.personalApiToken.trim();
    if (!token || token.length > 20_000)
      throw new VwoTestingApiError(
        "credential_missing",
        "VWO Testing personal API token is missing.",
      );
    const url = new URL(path, VwoTestingApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("limit", "25");
      url.searchParams.set("offset", "0");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: { Accept: "application/json", token },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("VWO Testing response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new VwoTestingApiError(
          this.safeCode(response.status),
          `VWO Testing returned HTTP ${response.status}.`,
          response.status,
        );
      const body = this.object(parsed);
      const items = operation.collection ? this.items(parsed) : [];
      const exact = operation.collection
        ? null
        : this.object(body.data ?? body._data ?? parsed);
      return {
        accountId,
        data: operation.collection
          ? items.slice(0, 25).map((feature) => this.summary(feature))
          : this.summary(exact),
        pagination: operation.collection
          ? {
              returned: Math.min(items.length, 25),
              total: this.number(body.total ?? body.totalCount ?? body.count),
              truncated: items.length > 25,
            }
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof VwoTestingApiError) throw error;
      throw new VwoTestingApiError(
        "provider_unavailable",
        "VWO Testing could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const feature = this.object(value);
    return {
      id: this.number(feature.id) ?? this.text(feature.id, 200),
      key: this.text(feature.key, 200),
      name: this.text(feature.name, 255),
      description: this.text(feature.description, 1_000),
      type: this.text(feature.type, 64),
      status: this.text(feature.status, 64),
      createdAt:
        this.text(feature.createdAt, 64) ?? this.text(feature.created_at, 64),
      updatedAt:
        this.text(feature.updatedAt, 64) ?? this.text(feature.updated_at, 64),
      projectCount: this.array(feature.projects).length,
      variableCount:
        this.array(feature.variables).length ||
        Object.keys(this.object(feature.variables)).length,
    };
  }

  private items(value: unknown) {
    if (Array.isArray(value)) return value;
    const body = this.object(value);
    for (const candidate of [
      body.features,
      body.items,
      body.data,
      body._data,
      this.object(body.data).features,
      this.object(body._data).features,
    ])
      if (Array.isArray(candidate)) return candidate;
    return [];
  }
  private operation(id: string) {
    const operation = VWO_TESTING_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new VwoTestingApiError(
        "tool_unavailable",
        "VWO Testing operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: VwoTestingInput) {
    for (const key of Object.keys(value))
      if (
        /(token|authorization|cookie|url|uri|endpoint|account|workspace|project|environment|enabled|rule|target|segment|audience|variable|variation|sdk|user|query|limit|offset|page|search|filter)/i.test(
          key,
        )
      )
        throw new VwoTestingApiError(
          "policy_blocked",
          "Credential, routing, evaluation, private-data, or pagination VWO Testing input fields are blocked.",
        );
  }
  private positiveInteger(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^\d{1,18}$/.test(text) || Number(text) < 1)
      throw this.validation(`VWO Testing ${label} must be a positive integer.`);
    return text;
  }
  private identifier(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(text))
      throw this.validation(
        `VWO Testing ${label} must be a safe feature identifier.`,
      );
    return text;
  }
  private parseJson(raw: Buffer): unknown {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("VWO Testing returned invalid JSON.");
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown, maximum: number) {
    return typeof value === "string" ? value.slice(0, maximum) : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new VwoTestingApiError("provider_validation_error", message);
  }
}

export class VwoTestingApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
