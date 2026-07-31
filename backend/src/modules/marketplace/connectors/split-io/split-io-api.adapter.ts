import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  SPLIT_IO_OPERATION_BY_ID,
  type SplitIoOperation,
} from "./split-io-operation-registry";

type JsonObject = Record<string, unknown>;
export type SplitIoCredentials = { adminApiKey: string; workspaceId: string };
export type SplitIoInput = { resourceId?: unknown };

@Injectable()
export class SplitIoApiAdapter {
  private static readonly ORIGIN = "https://api.split.io";

  health(credentials: SplitIoCredentials) {
    return this.read(credentials, "list_feature_flags", {});
  }

  read(
    credentials: SplitIoCredentials,
    operationId: string,
    input: SplitIoInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: SplitIoCredentials,
    operation: SplitIoOperation,
    input: SplitIoInput,
  ) {
    this.rejectInput(input);
    const workspaceId = this.identifier(credentials.workspaceId, "workspaceId");
    let path = operation.path.replace("{workspaceId}", workspaceId);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.identifier(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "Split.io resourceId is accepted only for exact reads.",
      );
    const apiKey = credentials.adminApiKey.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new SplitIoApiError(
        "credential_missing",
        "Split.io Feature Flag Viewer Admin API key is missing.",
      );
    const url = new URL(path, SplitIoApiAdapter.ORIGIN);
    if (operation.collection) {
      url.searchParams.set("offset", "0");
      url.searchParams.set("limit", "25");
    }
    try {
      const response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("Split.io response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new SplitIoApiError(
          this.safeCode(response.status),
          `Split.io returned HTTP ${response.status}.`,
          response.status,
        );
      const body = this.object(parsed);
      return {
        workspaceId: credentials.workspaceId.trim(),
        data: operation.collection
          ? this.array(body.objects)
              .slice(0, 25)
              .map((flag) => this.summary(flag))
          : this.summary(parsed),
        pagination: operation.collection
          ? { offset: 0, limit: 25, totalCount: this.number(body.totalCount) }
          : null,
        rateLimit: { retryAfter: response.headers.get("retry-after") },
      };
    } catch (error) {
      if (error instanceof SplitIoApiError) throw error;
      throw new SplitIoApiError(
        "provider_unavailable",
        "Split.io could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const flag = this.object(value);
    const trafficType = this.object(flag.trafficType);
    const rolloutStatus = this.object(flag.rolloutStatus);
    return {
      id: this.text(flag.id, 255),
      name: this.text(flag.name, 255),
      description: this.text(flag.description, 1_000),
      creationTime: this.number(flag.creationTime),
      trafficType: this.text(trafficType.name, 255),
      rolloutStatus: this.text(rolloutStatus.name, 255),
      rolloutStatusTimestamp: this.number(flag.rolloutStatusTimestamp),
      tags: this.array(flag.tags)
        .slice(0, 25)
        .map((tag) => this.text(this.object(tag).name, 100))
        .filter((tag): tag is string => tag !== null),
    };
  }

  private operation(id: string) {
    const operation = SPLIT_IO_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new SplitIoApiError(
        "tool_unavailable",
        "Split.io operation is not pinned.",
      );
    return operation;
  }

  private rejectInput(value: SplitIoInput) {
    for (const key of Object.keys(value))
      if (
        /(api.?key|token|authorization|cookie|url|uri|endpoint|workspace|environment|user|key|target|rule|treatment|query|offset|limit)/i.test(
          key,
        )
      )
        throw new SplitIoApiError(
          "policy_blocked",
          "Credential, routing, targeting, or pagination Split.io input fields are blocked.",
        );
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9_.-]{1,255}$/.test(text))
      throw this.validation(`Split.io ${label} is invalid.`);
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
    throw this.validation("Split.io returned invalid JSON.");
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
    return new SplitIoApiError("provider_validation_error", message);
  }
}

export class SplitIoApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
