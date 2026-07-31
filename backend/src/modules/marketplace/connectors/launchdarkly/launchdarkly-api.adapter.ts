import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  LAUNCHDARKLY_OPERATION_BY_ID,
  type LaunchDarklyOperation,
} from "./launchdarkly-operation-registry";

type JsonObject = Record<string, unknown>;
export type LaunchDarklyCredentials = {
  apiAccessToken: string;
  region: string;
  projectKey: string;
  environmentKey: string;
};
export type LaunchDarklyInput = { resourceId?: unknown };

@Injectable()
export class LaunchDarklyApiAdapter {
  private static readonly API_VERSION = "20240415";
  private static readonly ORIGINS: Record<string, string> = {
    commercial: "https://app.launchdarkly.com",
    eu: "https://app.eu.launchdarkly.com",
    federal: "https://app.launchdarkly.us",
  };

  health(credentials: LaunchDarklyCredentials) {
    return this.read(credentials, "list_feature_flags", {});
  }

  read(
    credentials: LaunchDarklyCredentials,
    operationId: string,
    input: LaunchDarklyInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: LaunchDarklyCredentials,
    operation: LaunchDarklyOperation,
    input: LaunchDarklyInput,
  ) {
    this.rejectSecrets(input);
    const projectKey = this.identifier(credentials.projectKey, "projectKey");
    const environmentKey = this.identifier(
      credentials.environmentKey,
      "environmentKey",
    );
    let path = operation.path.replace("{projectKey}", projectKey);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.identifier(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "LaunchDarkly resourceId is accepted only for exact reads.",
      );

    const token = credentials.apiAccessToken.trim();
    const origin =
      LaunchDarklyApiAdapter.ORIGINS[credentials.region.trim().toLowerCase()];
    if (!token || token.length > 20_000 || !origin)
      throw new LaunchDarklyApiError(
        "credential_missing",
        "LaunchDarkly API access token or region is missing.",
      );
    const url = new URL(path, origin);
    url.searchParams.set("env", environmentKey);
    if (operation.collection) {
      url.searchParams.set("limit", "25");
      url.searchParams.set("offset", "0");
      url.searchParams.set("summary", "true");
    }

    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: token,
          "LD-API-Version": LaunchDarklyApiAdapter.API_VERSION,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("LaunchDarkly response exceeds 1 MB.");
      const body = this.object(this.parseJson(raw));
      if (!response.ok)
        throw new LaunchDarklyApiError(
          this.safeCode(response.status),
          `LaunchDarkly returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        projectKey: credentials.projectKey.trim(),
        environmentKey: credentials.environmentKey.trim(),
        data: operation.collection
          ? this.array(body.items)
              .slice(0, 25)
              .map((flag) => this.flagSummary(flag, environmentKey))
          : this.flagSummary(body, environmentKey),
        pagination: operation.collection
          ? {
              totalCount: this.number(body.totalCount),
              hasNextPage: Boolean(this.object(body._links).next),
            }
          : null,
        rateLimit: {
          limit: response.headers.get("x-ratelimit-limit"),
          remaining: response.headers.get("x-ratelimit-remaining"),
          reset: response.headers.get("x-ratelimit-reset"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof LaunchDarklyApiError) throw error;
      throw new LaunchDarklyApiError(
        "provider_unavailable",
        "LaunchDarkly could not be reached.",
      );
    }
  }

  private flagSummary(value: unknown, environmentKey: string) {
    const flag = this.object(value);
    const environment = this.object(
      this.object(flag.environments)[environmentKey],
    );
    return {
      key: this.text(flag.key, 255),
      name: this.text(flag.name, 255),
      description: this.text(flag.description, 1_000),
      kind: this.text(flag.kind, 64),
      purpose: this.text(flag._purpose, 64),
      version: this.number(flag._version),
      creationDate: this.number(flag.creationDate),
      temporary: typeof flag.temporary === "boolean" ? flag.temporary : null,
      tags: this.array(flag.tags)
        .slice(0, 25)
        .map((tag) => this.text(tag, 100))
        .filter((tag): tag is string => tag !== null),
      variations: this.array(flag.variations)
        .slice(0, 20)
        .map((variation) => {
          const item = this.object(variation);
          return {
            id: this.text(item._id, 255),
            name: this.text(item.name, 255),
            description: this.text(item.description, 500),
          };
        }),
      environment: Object.keys(environment).length
        ? {
            on: typeof environment.on === "boolean" ? environment.on : null,
            archived:
              typeof environment.archived === "boolean"
                ? environment.archived
                : null,
            version: this.number(environment._version),
            lastModified: this.number(environment.lastModified),
            ruleCount: this.array(environment.rules).length,
            targetCount: this.array(environment.targets).length,
          }
        : null,
    };
  }

  private operation(id: string) {
    const operation = LAUNCHDARKLY_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new LaunchDarklyApiError(
        "tool_unavailable",
        "LaunchDarkly operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: LaunchDarklyInput) {
    for (const key of Object.keys(value))
      if (
        /(api.?key|token|authorization|cookie|url|uri|endpoint|origin|region|project|environment|context|user|email|ip|target|rule|variation|query|filter|offset|limit|expand)/i.test(
          key,
        )
      )
        throw new LaunchDarklyApiError(
          "policy_blocked",
          "Credential, routing, targeting, or pagination LaunchDarkly input fields are blocked.",
        );
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9_.-]{1,255}$/.test(text))
      throw this.validation(`LaunchDarkly ${label} is invalid.`);
    return encodeURIComponent(text);
  }

  private parseJson(raw: Buffer): unknown {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("LaunchDarkly returned invalid JSON.");
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
    return new LaunchDarklyApiError("provider_validation_error", message);
  }
}

export class LaunchDarklyApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
