import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  GROWTHBOOK_CLOUD_OPERATION_BY_ID,
  type GrowthBookCloudOperation,
} from "./growthbook-cloud-operation-registry";

type JsonObject = Record<string, unknown>;
export type GrowthBookCloudCredentials = {
  secretApiKey: string;
  projectId: string;
};
export type GrowthBookCloudInput = { resourceId?: unknown };

@Injectable()
export class GrowthBookCloudApiAdapter {
  private static readonly ORIGIN = "https://api.growthbook.io";

  health(credentials: GrowthBookCloudCredentials) {
    return this.read(credentials, "list_features", {});
  }

  read(
    credentials: GrowthBookCloudCredentials,
    operationId: string,
    input: GrowthBookCloudInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: GrowthBookCloudCredentials,
    operation: GrowthBookCloudOperation,
    input: GrowthBookCloudInput,
  ) {
    this.rejectInput(input);
    const projectId = this.identifier(credentials.projectId, "projectId");
    let path = operation.path;
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        encodeURIComponent(this.identifier(input.resourceId, "resourceId")),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "GrowthBook Cloud resourceId is accepted only for exact reads.",
      );
    const secretApiKey = credentials.secretApiKey.trim();
    if (!secretApiKey || secretApiKey.length > 20_000)
      throw new GrowthBookCloudApiError(
        "credential_missing",
        "GrowthBook Cloud read-only secret API key is missing.",
      );
    const url = new URL(path, GrowthBookCloudApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("limit", "25");
      url.searchParams.set("offset", "0");
      url.searchParams.set("projectId", projectId);
    } else {
      url.searchParams.set("withRevisions", "none");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${secretApiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("GrowthBook Cloud response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new GrowthBookCloudApiError(
          this.safeCode(response.status),
          `GrowthBook Cloud returned HTTP ${response.status}.`,
          response.status,
        );
      const body = this.object(parsed);
      return {
        projectId,
        data: operation.collection
          ? this.array(body.features)
              .slice(0, 25)
              .map((feature) => this.summary(feature))
          : this.summary(body.feature),
        pagination: operation.collection
          ? {
              count: this.number(body.count),
              total: this.number(body.total),
              hasMore: body.hasMore === true,
            }
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof GrowthBookCloudApiError) throw error;
      throw new GrowthBookCloudApiError(
        "provider_unavailable",
        "GrowthBook Cloud could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const feature = this.object(value);
    return {
      id: this.text(feature.id, 200),
      dateCreated: this.text(feature.dateCreated, 64),
      dateUpdated: this.text(feature.dateUpdated, 64),
      archived: typeof feature.archived === "boolean" ? feature.archived : null,
      description: this.text(feature.description, 1_000),
      project: this.text(feature.project, 200),
      valueType: this.text(feature.valueType, 64),
      tagCount: this.array(feature.tags).length,
      prerequisiteCount: this.array(feature.prerequisites).length,
    };
  }

  private operation(id: string) {
    const operation = GROWTHBOOK_CLOUD_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new GrowthBookCloudApiError(
        "tool_unavailable",
        "GrowthBook Cloud operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: GrowthBookCloudInput) {
    for (const key of Object.keys(value))
      if (
        /(token|secret|authorization|cookie|url|uri|endpoint|project|environment|owner|value|rule|condition|revision|query|page|limit|offset|search|tag|client)/i.test(
          key,
        )
      )
        throw new GrowthBookCloudApiError(
          "policy_blocked",
          "Credential, routing, private-data, or pagination GrowthBook Cloud input fields are blocked.",
        );
  }
  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(text))
      throw this.validation(
        `GrowthBook Cloud ${label} must be a safe identifier.`,
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
    throw this.validation("GrowthBook Cloud returned invalid JSON.");
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
    return new GrowthBookCloudApiError("provider_validation_error", message);
  }
}

export class GrowthBookCloudApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
