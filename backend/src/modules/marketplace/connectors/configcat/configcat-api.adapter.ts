import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  CONFIGCAT_OPERATION_BY_ID,
  type ConfigCatOperation,
} from "./configcat-operation-registry";

type JsonObject = Record<string, unknown>;
export type ConfigCatCredentials = {
  publicApiUsername: string;
  publicApiPassword: string;
  configId: string;
};
export type ConfigCatInput = { resourceId?: unknown };

@Injectable()
export class ConfigCatApiAdapter {
  private static readonly ORIGIN = "https://api.configcat.com";

  health(credentials: ConfigCatCredentials) {
    return this.read(credentials, "list_flags", {});
  }

  read(
    credentials: ConfigCatCredentials,
    operationId: string,
    input: ConfigCatInput,
  ) {
    return this.request(credentials, this.operation(operationId), input);
  }

  private async request(
    credentials: ConfigCatCredentials,
    operation: ConfigCatOperation,
    input: ConfigCatInput,
  ) {
    this.rejectInput(input);
    const configId = this.uuid(credentials.configId, "configId");
    let path = operation.path.replace("{configId}", configId);
    if (path.includes("{resourceId}"))
      path = path.replace(
        "{resourceId}",
        this.positiveInteger(input.resourceId, "resourceId"),
      );
    else if (input.resourceId !== undefined)
      throw this.validation(
        "ConfigCat resourceId is accepted only for exact reads.",
      );
    const username = credentials.publicApiUsername.trim();
    const password = credentials.publicApiPassword.trim();
    if (
      !username ||
      !password ||
      username.length > 10_000 ||
      password.length > 10_000
    )
      throw new ConfigCatApiError(
        "credential_missing",
        "ConfigCat Public API credentials are missing.",
      );
    try {
      const response = await safeConnectorFetch(new URL(path, ConfigCatApiAdapter.ORIGIN), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000)
        throw this.validation("ConfigCat response exceeds 1 MB.");
      const parsed = this.parseJson(raw);
      if (!response.ok)
        throw new ConfigCatApiError(
          this.safeCode(response.status),
          `ConfigCat returned HTTP ${response.status}.`,
          response.status,
        );
      const items = operation.collection ? this.array(parsed) : [parsed];
      return {
        configId,
        data: operation.collection
          ? items.slice(0, 25).map((flag) => this.summary(flag))
          : this.summary(parsed),
        pagination: operation.collection
          ? {
              returned: Math.min(items.length, 25),
              truncated: items.length > 25,
            }
          : null,
        rateLimit: {
          remaining: response.headers.get("x-rate-limit-remaining"),
          reset: response.headers.get("x-rate-limit-reset"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof ConfigCatApiError) throw error;
      throw new ConfigCatApiError(
        "provider_unavailable",
        "ConfigCat could not be reached.",
      );
    }
  }

  private summary(value: unknown) {
    const flag = this.object(value);
    return {
      settingId: this.number(flag.settingId),
      key: this.text(flag.key, 255),
      name: this.text(flag.name, 255),
      hint: this.text(flag.hint, 1_000),
      order: this.number(flag.order),
      settingType: this.text(flag.settingType, 64),
      configId: this.text(flag.configId, 64),
      configName: this.text(flag.configName, 255),
      createdAt: this.text(flag.createdAt, 64),
      tagCount: this.array(flag.tags).length,
      predefinedVariationCount: this.array(flag.predefinedVariations).length,
    };
  }

  private operation(id: string) {
    const operation = CONFIGCAT_OPERATION_BY_ID.get(id);
    if (!operation)
      throw new ConfigCatApiError(
        "tool_unavailable",
        "ConfigCat operation is not pinned.",
      );
    return operation;
  }
  private rejectInput(value: ConfigCatInput) {
    for (const key of Object.keys(value))
      if (
        /(credential|password|username|authorization|cookie|url|uri|endpoint|config|product|organization|environment|value|rule|variation|query|page|size|search|tag)/i.test(
          key,
        )
      )
        throw new ConfigCatApiError(
          "policy_blocked",
          "Credential, routing, private-data, or pagination ConfigCat input fields are blocked.",
        );
  }
  private uuid(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        text,
      )
    )
      throw this.validation(`ConfigCat ${label} must be a UUID.`);
    return text;
  }
  private positiveInteger(value: unknown, label: string) {
    const text =
      typeof value === "string" || typeof value === "number"
        ? String(value).trim()
        : "";
    if (!/^\d{1,10}$/.test(text) || Number(text) < 1)
      throw this.validation(`ConfigCat ${label} must be a positive integer.`);
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
    throw this.validation("ConfigCat returned invalid JSON.");
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
    return new ConfigCatApiError("provider_validation_error", message);
  }
}

export class ConfigCatApiError extends Error {
  constructor(
    readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
