import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  STATSIG_OPERATION_BY_ID,
  type StatsigOperation,
} from "./statsig-operation-registry";

type JsonObject = Record<string, unknown>;
export type StatsigCredentials = { personalConsoleApiKey: string };
export type StatsigInput = { resourceId?: unknown };

@Injectable()
export class StatsigApiAdapter {
  private static readonly ORIGIN = "https://statsigapi.net";
  private static readonly API_VERSION = "20240601";
  private static readonly EXPERIMENT_FIELDS = [
    "id",
    "name",
    "description",
    "hypothesis",
    "status",
    "groups",
    "tags",
    "version",
    "createdTime",
    "lastModifiedTime",
    "experimentType",
    "isStale",
  ].join(",");

  health(credentials: StatsigCredentials) {
    return this.read(credentials, "list_gates", {});
  }

  read(
    credentials: StatsigCredentials,
    operationId: string,
    input: StatsigInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: StatsigCredentials,
    operation: StatsigOperation,
    input: StatsigInput,
  ) {
    this.rejectSecrets(input);
    let path = operation.path;
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.identifier(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "Statsig resourceId is accepted only for exact reads.",
      );

    const apiKey = credentials.personalConsoleApiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new StatsigApiError(
        "credential_missing",
        "Statsig personal Console API key is missing.",
      );
    const url = new URL(path, StatsigApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("limit", "25");
      url.searchParams.set("page", "1");
    }
    if (operation.kind === "gate" && operation.collection)
      url.searchParams.set("includeArchived", "false");
    if (operation.kind === "experiment")
      url.searchParams.set("fields", StatsigApiAdapter.EXPERIMENT_FIELDS);

    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "STATSIG-API-KEY": apiKey,
          "STATSIG-API-VERSION": StatsigApiAdapter.API_VERSION,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Statsig response exceeds 1 MB.");
      const body = this.object(this.parseJson(raw));
      if (!response.ok)
        throw new StatsigApiError(
          this.safeCode(response.status),
          `Statsig returned HTTP ${response.status}.`,
          response.status,
        );
      const providerData = body.data;
      return {
        data: operation.collection
          ? this.array(providerData)
              .slice(0, 25)
              .map((value) => this.summary(value, operation.kind))
          : this.summary(providerData, operation.kind),
        pagination: operation.collection
          ? this.paginationSummary(body.pagination)
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof StatsigApiError) throw error;
      throw new StatsigApiError(
        "provider_unavailable",
        "Statsig could not be reached.",
      );
    }
  }

  private summary(value: unknown, kind: StatsigOperation["kind"]) {
    const entity = this.object(value);
    return {
      kind,
      id: this.text(entity.id, 255),
      name: this.text(entity.name, 255),
      description: this.text(entity.description, 1_000),
      hypothesis:
        kind === "experiment" ? this.text(entity.hypothesis, 1_000) : null,
      enabled: typeof entity.isEnabled === "boolean" ? entity.isEnabled : null,
      status: this.text(entity.status, 100),
      type:
        kind === "experiment"
          ? this.text(entity.experimentType, 100)
          : this.text(entity.type, 100),
      typeReason: this.text(entity.typeReason, 160),
      stale: typeof entity.isStale === "boolean" ? entity.isStale : null,
      version: this.number(entity.version),
      checksPerHour: this.number(entity.checksPerHour),
      createdTime: this.number(entity.createdTime),
      lastModifiedTime: this.number(entity.lastModifiedTime),
      tags: this.array(entity.tags)
        .slice(0, 25)
        .map((tag) => this.text(tag, 100))
        .filter((tag): tag is string => tag !== null),
      rules:
        kind === "experiment"
          ? []
          : this.array(entity.rules)
              .slice(0, 50)
              .map((rule) => this.ruleSummary(rule)),
      groups:
        kind === "experiment"
          ? this.array(entity.groups)
              .slice(0, 20)
              .map((group) => this.groupSummary(group))
          : [],
    };
  }

  private ruleSummary(value: unknown) {
    const rule = this.object(value);
    return {
      id: this.text(rule.id, 255),
      name: this.text(rule.name, 255),
      passPercentage: this.number(rule.passPercentage),
      conditionCount: this.array(rule.conditions).length,
      environments: this.array(rule.environments)
        .slice(0, 20)
        .map((item) => this.text(item, 100))
        .filter((item): item is string => item !== null),
    };
  }

  private groupSummary(value: unknown) {
    const group = this.object(value);
    return {
      id: this.text(group.id, 255),
      name: this.text(group.name, 255),
      size: this.number(group.size),
      disabled: typeof group.disabled === "boolean" ? group.disabled : null,
    };
  }

  private paginationSummary(value: unknown) {
    const pagination = this.object(value);
    return {
      pageNumber: this.number(pagination.pageNumber),
      itemsPerPage: this.number(pagination.itemsPerPage),
      totalItems: this.number(pagination.totalItems),
      hasNextPage:
        typeof pagination.nextPage === "string" &&
        pagination.nextPage.length > 0,
    };
  }

  private operation(id: string) {
    const operation = STATSIG_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new StatsigApiError(
        "tool_unavailable",
        "Statsig operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: StatsigInput) {
    for (const key of Object.keys(value))
      if (
        /(api.?key|token|authorization|cookie|url|uri|endpoint|person|user|email|ip|property|target|override|metric|event|exposure|query|page|limit)/i.test(
          key,
        )
      )
        throw new StatsigApiError(
          "policy_blocked",
          "Credential, routing, targeting, analytics, or pagination Statsig input fields are blocked.",
        );
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9_.-]{1,255}$/.test(text))
      throw this.validation(`Statsig ${label} is invalid.`);
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
    throw this.validation("Statsig returned invalid JSON.");
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
    return new StatsigApiError("provider_validation_error", message);
  }
}

export class StatsigApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
