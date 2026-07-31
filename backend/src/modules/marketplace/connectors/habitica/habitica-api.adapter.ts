import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type HabiticaCredentials = { userId: string; apiToken: string };

export class HabiticaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HabiticaApiAdapter {
  health(credentials: HabiticaCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/user",
      query: { userFields: "_id,auth.local.username,profile.name" },
    });
  }

  read(credentials: HabiticaCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
    });
  }

  manage(credentials: HabiticaCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: this.required(input.method, "method", 10),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      json: this.object(input.json),
    });
  }

  async request(
    credentials: HabiticaCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (
      !/^[0-9a-f-]{16,64}$/i.test(credentials.userId?.trim() ?? "") ||
      !credentials.apiToken?.trim() ||
      credentials.apiToken.length > 10_000
    ) {
      throw new HabiticaApiError(
        "credential_missing",
        "Habitica User ID and API token are required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/(?:challenges|chat|content|coupons|cron|groups|hall|i18n|inbox|members|news|notifications|quests|shops|status|tags|tasks|user|world-state)(?:\/[A-Za-z0-9_.:@%+~-]+)*$/.test(
        input.path,
      ) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      input.path.includes("?") ||
      input.path.includes("#")
    ) {
      throw this.validation(
        "Habitica method or documented third-party API path is invalid.",
      );
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    const url = new URL(`https://habitica.com/api/v3${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-user": credentials.userId.trim(),
      "x-api-key": credentials.apiToken.trim(),
      "x-client": `${credentials.userId.trim()}-RelayConsole`,
    };
    let body: string | undefined;
    if (method !== "GET" && input.json) {
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 2_000_000) {
        throw this.validation("Habitica request exceeds 2 MB.");
      }
    }
    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000) {
        throw this.validation("Habitica response exceeds 5 MB.");
      }
      let data: unknown;
      try {
        data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = raw.toString("utf8").slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new HabiticaApiError(
          this.code(response.status),
          this.message(data) ?? `Habitica returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof HabiticaApiError) throw error;
      throw new HabiticaApiError(
        "provider_unavailable",
        "Habitica could not be reached.",
        502,
      );
    }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw this.validation("Habitica query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) {
        throw this.validation("Habitica query field is invalid.");
      }
      const entries = Array.isArray(item) ? item : [item];
      if (entries.length > 100) {
        throw this.validation("Habitica query array is too large.");
      }
      for (const entry of entries) {
        if (entry == null || entry === "") continue;
        if (!["string", "number", "boolean"].includes(typeof entry)) {
          throw this.validation("Habitica query value is invalid.");
        }
        params.append(key, String(entry).slice(0, 10_000));
      }
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) {
        throw new HabiticaApiError(
          "policy_blocked",
          "Habitica request is too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 1000) {
          throw new HabiticaApiError(
            "policy_blocked",
            "Habitica request array is too large.",
          );
        }
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) {
        throw new HabiticaApiError(
          "policy_blocked",
          "Habitica request object is too large.",
        );
      }
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new HabiticaApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        }
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key)/i.test(key)
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    const object =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate =
      object?.message ?? object?.error_description ?? object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(statusCode: number): MarketplaceConnectorSafeErrorCode {
    if (statusCode === 401) return "token_expired";
    if (statusCode === 403) return "insufficient_scope";
    if (statusCode === 429) return "provider_rate_limited";
    if (statusCode >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new HabiticaApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
