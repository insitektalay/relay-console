import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  POSTHOG_FEATURE_FLAGS_OPERATION_BY_ID,
  type PostHogFeatureFlagsOperation,
} from "./posthog-feature-flags-operation-registry";

type JsonObject = Record<string, unknown>;
export type PostHogFeatureFlagsCredentials = {
  personalApiKey: string;
  region: string;
  projectId: string;
};
export type PostHogFeatureFlagsInput = { resourceId?: unknown };

@Injectable()
export class PostHogFeatureFlagsApiAdapter {
  private static readonly ORIGINS: Record<string, string> = {
    us: "https://us.posthog.com",
    eu: "https://eu.posthog.com",
  };

  health(credentials: PostHogFeatureFlagsCredentials) {
    return this.read(credentials, "list_active_feature_flags", {});
  }

  read(
    credentials: PostHogFeatureFlagsCredentials,
    operationId: string,
    input: PostHogFeatureFlagsInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: PostHogFeatureFlagsCredentials,
    operation: PostHogFeatureFlagsOperation,
    input: PostHogFeatureFlagsInput,
  ) {
    this.rejectSecrets(input);
    const projectId = this.positiveInteger(credentials.projectId, "projectId");
    let path = operation.path.replace("{projectId}", projectId);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.positiveInteger(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "PostHog Feature Flags resourceId is accepted only for exact reads.",
      );

    const token = credentials.personalApiKey.trim();
    const origin =
      PostHogFeatureFlagsApiAdapter.ORIGINS[
        credentials.region.trim().toLowerCase()
      ];
    if (!token || token.length > 20_000 || !origin)
      throw new PostHogFeatureFlagsApiError(
        "credential_missing",
        "PostHog Feature Flags personal API key or region is missing.",
      );
    const url = new URL(path, origin);
    if (operation.collection) {
      url.searchParams.set("limit", "25");
      url.searchParams.set("offset", "0");
      url.searchParams.set("active", "true");
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
        throw this.validation("PostHog Feature Flags response exceeds 1 MB.");
      const data = this.parseJson(raw);
      if (!response.ok)
        throw new PostHogFeatureFlagsApiError(
          this.safeCode(response.status),
          `PostHog Feature Flags returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        projectId,
        data: operation.collection
          ? {
              results: this.array(this.object(data).results)
                .slice(0, 25)
                .map((value) => this.flagSummary(value)),
            }
          : this.flagSummary(data),
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof PostHogFeatureFlagsApiError) throw error;
      throw new PostHogFeatureFlagsApiError(
        "provider_unavailable",
        "PostHog Feature Flags could not be reached.",
      );
    }
  }

  private flagSummary(value: unknown) {
    const flag = this.object(value);
    const filters = this.object(flag.filters);
    const multivariate = this.object(filters.multivariate);
    return {
      id: this.scalar(flag.id),
      key: this.text(flag.key, 255),
      name: this.text(flag.name, 255),
      active: typeof flag.active === "boolean" ? flag.active : null,
      type: this.text(flag.type, 64),
      createdAt: this.text(flag.created_at, 64),
      updatedAt: this.text(flag.last_modified_at, 64),
      tags: this.array(flag.tags)
        .slice(0, 25)
        .map((tag) => this.text(tag, 100))
        .filter((tag): tag is string => tag !== null),
      rolloutPercentage: this.number(filters.rollout_percentage),
      variants: this.array(multivariate.variants)
        .slice(0, 20)
        .map((value) => {
          const variant = this.object(value);
          return {
            key: this.text(variant.key, 100),
            name: this.text(variant.name, 160),
            rolloutPercentage: this.number(variant.rollout_percentage),
          };
        }),
      conditionCount: this.array(filters.groups).length,
    };
  }

  private operation(id: string) {
    const operation = POSTHOG_FEATURE_FLAGS_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new PostHogFeatureFlagsApiError(
        "tool_unavailable",
        "PostHog Feature Flags operation is not pinned.",
      );
    return operation;
  }

  private rejectSecrets(value: PostHogFeatureFlagsInput) {
    for (const key of Object.keys(value))
      if (
        /(api.?key|token|authorization|cookie|url|uri|endpoint|origin|region|project|person|distinct|property|cohort|group)/i.test(
          key,
        )
      )
        throw new PostHogFeatureFlagsApiError(
          "policy_blocked",
          "Credential, routing, or targeting PostHog Feature Flags input fields are blocked.",
        );
  }

  private positiveInteger(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^\d{1,18}$/.test(text) || Number(text) < 1)
      throw this.validation(
        `PostHog Feature Flags ${label} must be a positive integer.`,
      );
    return text;
  }

  private parseJson(raw: Buffer): JsonObject | unknown[] {
    if (!raw.length) return {};
    try {
      const value = JSON.parse(raw.toString("utf8"));
      if (value && typeof value === "object") return value;
    } catch {
      /* normalize */
    }
    throw this.validation("PostHog Feature Flags returned invalid JSON.");
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

  private scalar(value: unknown) {
    return typeof value === "string" || typeof value === "number"
      ? value
      : null;
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
    return new PostHogFeatureFlagsApiError(
      "provider_validation_error",
      message,
    );
  }
}

export class PostHogFeatureFlagsApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
