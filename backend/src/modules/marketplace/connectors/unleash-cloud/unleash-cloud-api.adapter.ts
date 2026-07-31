import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  UNLEASH_CLOUD_OPERATION_BY_ID,
  type UnleashCloudOperation,
} from "./unleash-cloud-operation-registry";

type JsonObject = Record<string, unknown>;
export type UnleashCloudCredentials = {
  backendToken: string;
  instanceUrl: string;
  projectId: string;
  environment: string;
};
export type UnleashCloudInput = { resourceId?: unknown };

@Injectable()
export class UnleashCloudApiAdapter {
  health(credentials: UnleashCloudCredentials) {
    return this.read(credentials, "list_features", {});
  }

  read(
    credentials: UnleashCloudCredentials,
    operationId: string,
    input: UnleashCloudInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: UnleashCloudCredentials,
    operation: UnleashCloudOperation,
    input: UnleashCloudInput,
  ) {
    this.rejectInput(input);
    const projectId = this.identifier(credentials.projectId, "projectId");
    const environment = this.identifier(credentials.environment, "environment");
    const base = this.cloudInstance(credentials.instanceUrl);
    let path = operation.path;
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        encodeURIComponent(this.identifier(input.resourceId, "resourceId")),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "Unleash Cloud resourceId is accepted only for exact reads.",
      );
    const backendToken = credentials.backendToken.trim();
    if (!backendToken || backendToken.length > 20_000)
      throw new UnleashCloudApiError(
        "credential_missing",
        "Unleash Cloud backend token is missing.",
      );
    const url = new URL(base);
    url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: backendToken,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Unleash Cloud response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new UnleashCloudApiError(
          this.safeCode(response.status),
          `Unleash Cloud returned HTTP ${response.status}.`,
          response.status,
        );
      if (!operation.collection) {
        this.requireProject(parsed, projectId);
        return {
          projectId,
          environment,
          data: this.summary(parsed),
          pagination: null,
        };
      }
      const body = this.object(parsed);
      const features = this.array(body.features).filter(
        (feature) => this.object(feature).project === projectId,
      );
      return {
        projectId,
        environment,
        data: features.slice(0, 25).map((feature) => this.summary(feature)),
        pagination: {
          returned: Math.min(features.length, 25),
          truncated: features.length > 25,
        },
      };
    } catch (error) {
      if (error instanceof UnleashCloudApiError) throw error;
      throw new UnleashCloudApiError(
        "provider_unavailable",
        "Unleash Cloud could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const feature = this.object(value);
    return {
      name: this.text(feature.name, 100),
      type: this.text(feature.type, 64),
      description: this.text(feature.description, 1_000),
      stale: typeof feature.stale === "boolean" ? feature.stale : null,
      impressionData:
        typeof feature.impressionData === "boolean"
          ? feature.impressionData
          : null,
      project: this.text(feature.project, 200),
      createdAt: this.text(feature.createdAt, 64),
      lastSeenAt: this.text(feature.lastSeenAt, 64),
      strategyCount: this.array(feature.strategies).length,
      variantCount: this.array(feature.variants).length,
      dependencyCount: this.array(feature.dependencies).length,
    };
  }

  private requireProject(value: unknown, projectId: string) {
    if (this.object(value).project !== projectId)
      throw new UnleashCloudApiError(
        "policy_blocked",
        "Unleash Cloud feature is outside the stored project binding.",
      );
  }
  private cloudInstance(value: unknown) {
    let url: URL;
    try {
      url = new URL(typeof value === "string" ? value.trim() : "");
    } catch {
      throw this.validation("Unleash Cloud instance URL is invalid.");
    }
    if (
      url.protocol !== "https:" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^(?:[a-z0-9-]+\.)?app\.unleash-hosted\.com$/i.test(url.hostname) ||
      !/^\/[A-Za-z0-9_-]{1,200}\/?$/.test(url.pathname)
    )
      throw this.validation(
        "Unleash Cloud instance URL must be an allowlisted hosted instance.",
      );
    url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString().replace(/\/$/, "");
  }
  private operation(id: string) {
    const operation = UNLEASH_CLOUD_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new UnleashCloudApiError(
        "tool_unavailable",
        "Unleash Cloud operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: UnleashCloudInput) {
    for (const key of Object.keys(value))
      if (
        /(token|authorization|cookie|url|uri|endpoint|project|environment|context|user|session|remote|property|enabled|strategy|constraint|variant|dependency|query|page|limit|offset|search|tag)/i.test(
          key,
        )
      )
        throw new UnleashCloudApiError(
          "policy_blocked",
          "Credential, routing, evaluation, private-data, or pagination Unleash Cloud input fields are blocked.",
        );
  }
  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(text))
      throw this.validation(
        `Unleash Cloud ${label} must be a safe identifier.`,
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
    throw this.validation("Unleash Cloud returned invalid JSON.");
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
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new UnleashCloudApiError("provider_validation_error", message);
  }
}

export class UnleashCloudApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
