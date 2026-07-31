import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  AB_TASTY_FEATURE_EXPERIMENTATION_OPERATION_BY_ID,
  type AbTastyFeatureExperimentationOperation,
} from "./ab-tasty-feature-experimentation-operation-registry";

type JsonObject = Record<string, unknown>;
export type AbTastyFeatureExperimentationCredentials = {
  remoteControlApiToken: string;
  accountId: string;
  accountEnvironmentId: string;
};
export type AbTastyFeatureExperimentationInput = { resourceId?: unknown };

@Injectable()
export class AbTastyFeatureExperimentationApiAdapter {
  private static readonly ORIGIN = "https://api.flagship.io";

  health(credentials: AbTastyFeatureExperimentationCredentials) {
    return this.read(credentials, "list_campaigns", {});
  }

  read(
    credentials: AbTastyFeatureExperimentationCredentials,
    operationId: string,
    input: AbTastyFeatureExperimentationInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: AbTastyFeatureExperimentationCredentials,
    operation: AbTastyFeatureExperimentationOperation,
    input: AbTastyFeatureExperimentationInput,
  ) {
    this.rejectInput(input);
    const accountId = this.identifier(credentials.accountId, "accountId");
    const accountEnvironmentId = this.identifier(
      credentials.accountEnvironmentId,
      "accountEnvironmentId",
    );
    let path = operation.path
      .replace("{accountId}", encodeURIComponent(accountId))
      .replace(
        "{accountEnvironmentId}",
        encodeURIComponent(accountEnvironmentId),
      );
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        encodeURIComponent(this.identifier(input.resourceId, "resourceId")),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "AB Tasty Feature Experimentation resourceId is accepted only for exact reads.",
      );
    const token = credentials.remoteControlApiToken.trim();
    if (!token || token.length > 20_000)
      throw new AbTastyFeatureExperimentationApiError(
        "credential_missing",
        "AB Tasty Feature Experimentation Remote Control API token is missing.",
      );
    const url = new URL(path, AbTastyFeatureExperimentationApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("_page", "0");
      url.searchParams.set("_max_per_page", "25");
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
        throw this.validation(
          "AB Tasty Feature Experimentation response exceeds 1 MB.",
        );
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new AbTastyFeatureExperimentationApiError(
          this.safeCode(response.status),
          `AB Tasty Feature Experimentation returned HTTP ${response.status}.`,
          response.status,
        );
      const body = this.object(parsed);
      const items = operation.collection ? this.items(parsed) : [];
      return {
        accountId,
        accountEnvironmentId,
        data: operation.collection
          ? items.slice(0, 25).map((campaign) => this.summary(campaign))
          : this.summary(parsed),
        pagination: operation.collection
          ? {
              returned: Math.min(items.length, 25),
              total: this.number(body.total_count),
              truncated:
                items.length > 25 ||
                (this.number(body.total_count) ?? 0) >
                  Math.min(items.length, 25),
            }
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof AbTastyFeatureExperimentationApiError) throw error;
      throw new AbTastyFeatureExperimentationApiError(
        "provider_unavailable",
        "AB Tasty Feature Experimentation could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const campaign = this.object(value);
    return {
      id: this.text(campaign.id, 200),
      projectId: this.text(campaign.project_id, 200),
      name: this.text(campaign.name, 255),
      slug: this.text(campaign.slug, 255),
      description: this.text(campaign.description, 1_000),
      type: this.text(campaign.type, 64),
      status: this.text(campaign.status, 64),
      createdAt: this.text(campaign.created_at, 64),
      updatedAt: this.text(campaign.updated_at, 64),
    };
  }

  private items(value: unknown) {
    if (Array.isArray(value)) return value;
    const body = this.object(value);
    return Array.isArray(body.items) ? body.items : [];
  }
  private operation(id: string) {
    const operation = AB_TASTY_FEATURE_EXPERIMENTATION_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new AbTastyFeatureExperimentationApiError(
        "tool_unavailable",
        "AB Tasty Feature Experimentation operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: AbTastyFeatureExperimentationInput) {
    for (const key of Object.keys(value))
      if (
        /(token|authorization|cookie|url|uri|endpoint|account|environment|project|goal|metric|schedule|target|segment|audience|variation|flag|value|user|query|limit|offset|page|search|filter)/i.test(
          key,
        )
      )
        throw new AbTastyFeatureExperimentationApiError(
          "policy_blocked",
          "Credential, routing, private-data, or pagination AB Tasty Feature Experimentation input fields are blocked.",
        );
  }
  private identifier(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(text))
      throw this.validation(
        `AB Tasty Feature Experimentation ${label} must be a safe identifier.`,
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
    throw this.validation(
      "AB Tasty Feature Experimentation returned invalid JSON.",
    );
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
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
    return new AbTastyFeatureExperimentationApiError(
      "provider_validation_error",
      message,
    );
  }
}

export class AbTastyFeatureExperimentationApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
