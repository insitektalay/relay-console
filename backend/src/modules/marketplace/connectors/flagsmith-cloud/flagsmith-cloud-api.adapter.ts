import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  FLAGSMITH_CLOUD_OPERATION_BY_ID,
  type FlagsmithCloudOperation,
} from "./flagsmith-cloud-operation-registry";

type JsonObject = Record<string, unknown>;
export type FlagsmithCloudCredentials = {
  serviceAccountToken: string;
  projectId: string;
};
export type FlagsmithCloudInput = { resourceId?: unknown };

@Injectable()
export class FlagsmithCloudApiAdapter {
  private static readonly ORIGIN = "https://api.flagsmith.com";

  health(credentials: FlagsmithCloudCredentials) {
    return this.read(credentials, "list_features", {});
  }

  read(
    credentials: FlagsmithCloudCredentials,
    operationId: string,
    input: FlagsmithCloudInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: FlagsmithCloudCredentials,
    operation: FlagsmithCloudOperation,
    input: FlagsmithCloudInput,
  ) {
    this.rejectInput(input);
    const projectId = this.positiveInteger(credentials.projectId, "projectId");
    let path = operation.path.replace("{projectId}", projectId);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.positiveInteger(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "Flagsmith Cloud resourceId is accepted only for exact reads.",
      );
    const token = credentials.serviceAccountToken.trim();
    if (!token || token.length > 20_000)
      throw new FlagsmithCloudApiError(
        "credential_missing",
        "Flagsmith Cloud service-account token is missing.",
      );
    const url = new URL(path, FlagsmithCloudApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("page", "1");
      url.searchParams.set("page_size", "25");
      url.searchParams.set("is_archived", "false");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Token ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Flagsmith Cloud response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new FlagsmithCloudApiError(
          this.safeCode(response.status),
          `Flagsmith Cloud returned HTTP ${response.status}.`,
          response.status,
        );
      const body = this.object(parsed);
      return {
        projectId,
        data: operation.collection
          ? this.array(body.results)
              .slice(0, 25)
              .map((feature) => this.summary(feature))
          : this.summary(parsed),
        pagination: operation.collection
          ? {
              count: this.number(body.count),
              hasNextPage:
                typeof body.next === "string" && body.next.length > 0,
            }
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof FlagsmithCloudApiError) throw error;
      throw new FlagsmithCloudApiError(
        "provider_unavailable",
        "Flagsmith Cloud could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const feature = this.object(value);
    return {
      id: this.number(feature.id),
      name: this.text(feature.name, 2_000),
      description: this.text(feature.description, 1_000),
      type: this.text(feature.type, 64),
      defaultEnabled:
        typeof feature.default_enabled === "boolean"
          ? feature.default_enabled
          : null,
      createdDate: this.text(feature.created_date, 64),
      archived:
        typeof feature.is_archived === "boolean" ? feature.is_archived : null,
      serverKeyOnly:
        typeof feature.is_server_key_only === "boolean"
          ? feature.is_server_key_only
          : null,
      lifecycleStage: this.text(feature.lifecycle_stage, 64),
      tagCount: this.array(feature.tags).length,
      multivariateOptionCount: this.array(feature.multivariate_options).length,
      lastModified: this.text(feature.last_modified_in_any_environment, 64),
    };
  }

  private operation(id: string) {
    const operation = FLAGSMITH_CLOUD_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new FlagsmithCloudApiError(
        "tool_unavailable",
        "Flagsmith Cloud operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: FlagsmithCloudInput) {
    for (const key of Object.keys(value))
      if (
        /(token|authorization|cookie|url|uri|endpoint|project|environment|identity|owner|value|metadata|query|page|size|search|tag|segment)/i.test(
          key,
        )
      )
        throw new FlagsmithCloudApiError(
          "policy_blocked",
          "Credential, routing, private-data, or pagination Flagsmith Cloud input fields are blocked.",
        );
  }
  private positiveInteger(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^\d{1,18}$/.test(text) || Number(text) < 1)
      throw this.validation(
        `Flagsmith Cloud ${label} must be a positive integer.`,
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
    throw this.validation("Flagsmith Cloud returned invalid JSON.");
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
    return new FlagsmithCloudApiError("provider_validation_error", message);
  }
}

export class FlagsmithCloudApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
