import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  OPTIMIZELY_ROLLOUTS_OPERATION_BY_ID,
  type OptimizelyRolloutsOperation,
} from "./optimizely-rollouts-operation-registry";

type JsonObject = Record<string, unknown>;
export type OptimizelyRolloutsCredentials = {
  personalAccessToken: string;
  projectId: string;
};
export type OptimizelyRolloutsInput = { resourceId?: unknown };

@Injectable()
export class OptimizelyRolloutsApiAdapter {
  private static readonly ORIGIN = "https://api.optimizely.com";

  health(credentials: OptimizelyRolloutsCredentials) {
    return this.read(credentials, "list_flags", {});
  }

  read(
    credentials: OptimizelyRolloutsCredentials,
    operationId: string,
    input: OptimizelyRolloutsInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: OptimizelyRolloutsCredentials,
    operation: OptimizelyRolloutsOperation,
    input: OptimizelyRolloutsInput,
  ) {
    this.rejectInput(input);
    const projectId = this.positiveInteger(credentials.projectId, "projectId");
    let path = operation.path.replace("{projectId}", projectId);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        encodeURIComponent(this.identifier(input.resourceId, "resourceId")),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "Optimizely Rollouts resourceId is accepted only for exact reads.",
      );
    const token = credentials.personalAccessToken.trim();
    if (!token || token.length > 20_000)
      throw new OptimizelyRolloutsApiError(
        "credential_missing",
        "Optimizely Rollouts Viewer personal access token is missing.",
      );
    const url = new URL(path, OptimizelyRolloutsApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("per_page", "25");
      url.searchParams.set("page_number", "1");
      url.searchParams.set("archived", "false");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Optimizely Rollouts response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new OptimizelyRolloutsApiError(
          this.safeCode(response.status),
          `Optimizely Rollouts returned HTTP ${response.status}.`,
          response.status,
        );
      const body = this.object(parsed);
      if (!operation.collection) this.requireProject(body, projectId);
      return {
        projectId,
        data: operation.collection
          ? this.array(body.items)
              .slice(0, 25)
              .map((flag) => this.summary(flag))
          : this.summary(body),
        pagination: operation.collection
          ? {
              page: this.number(body.page),
              count: this.number(body.count),
              totalCount: this.number(body.total_count),
              totalPages: this.number(body.total_pages),
            }
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof OptimizelyRolloutsApiError) throw error;
      throw new OptimizelyRolloutsApiError(
        "provider_unavailable",
        "Optimizely Rollouts could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const flag = this.object(value);
    return {
      id: this.number(flag.id),
      key: this.text(flag.key, 200),
      name: this.text(flag.name, 255),
      description: this.text(flag.description, 1_000),
      archived: typeof flag.archived === "boolean" ? flag.archived : null,
      outlierFilteringEnabled:
        typeof flag.outlier_filtering_enabled === "boolean"
          ? flag.outlier_filtering_enabled
          : null,
      projectId: this.number(flag.project_id),
      createdTime: this.text(flag.created_time, 64),
      updatedTime: this.text(flag.updated_time, 64),
      revision: this.number(flag.revision),
      variableDefinitionCount: Object.keys(
        this.object(flag.variable_definitions),
      ).length,
      environmentCount: Object.keys(this.object(flag.environments)).length,
    };
  }

  private requireProject(value: JsonObject, projectId: string) {
    if (String(value.project_id ?? "") !== projectId)
      throw new OptimizelyRolloutsApiError(
        "policy_blocked",
        "Optimizely Rollouts flag is outside the stored project binding.",
      );
  }
  private operation(id: string) {
    const operation = OPTIMIZELY_ROLLOUTS_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new OptimizelyRolloutsApiError(
        "tool_unavailable",
        "Optimizely Rollouts operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: OptimizelyRolloutsInput) {
    for (const key of Object.keys(value))
      if (
        /(token|authorization|cookie|url|uri|endpoint|project|account|user|email|role|environment|enabled|rule|audience|variable|variation|metric|query|page|sort|filter|archived|search)/i.test(
          key,
        )
      )
        throw new OptimizelyRolloutsApiError(
          "policy_blocked",
          "Credential, routing, private-data, or pagination Optimizely Rollouts input fields are blocked.",
        );
  }
  private positiveInteger(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^\d{1,18}$/.test(text) || Number(text) < 1)
      throw this.validation(
        `Optimizely Rollouts ${label} must be a positive integer.`,
      );
    return text;
  }
  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(text))
      throw this.validation(
        `Optimizely Rollouts ${label} must be a safe flag key.`,
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
    throw this.validation("Optimizely Rollouts returned invalid JSON.");
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
    return new OptimizelyRolloutsApiError("provider_validation_error", message);
  }
}

export class OptimizelyRolloutsApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
