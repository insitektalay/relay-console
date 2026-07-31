import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type JsonBody = JsonObject | unknown[];
type Method = "GET" | "POST" | "PUT" | "DELETE";

export type FollowUpBossCredentials = {
  apiKey: string;
  systemName: string;
  systemKey: string;
};

const NUMERIC_ID = "\\d+";
const READ_RESOURCE =
  "(?:people|users|events|notes|calls|appointments|tasks|deals|stages|sources|tags|ponds|teams|customFields|actionPlans|automations)";

const READ_ROUTES = [
  /^\/identity$/,
  new RegExp(`^/${READ_RESOURCE}$`),
  new RegExp(`^/${READ_RESOURCE}/${NUMERIC_ID}$`),
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", /^\/events$/],
  ["POST", /^\/(?:people|notes|calls|appointments|tasks|deals)$/],
  [
    "PUT",
    new RegExp(`^/(?:people|notes|calls|appointments|tasks|deals)/${NUMERIC_ID}$`),
  ],
  [
    "DELETE",
    new RegExp(`^/(?:notes|calls|appointments|tasks|deals)/${NUMERIC_ID}$`),
  ],
];

export class FollowUpBossApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class FollowUpBossApiAdapter {
  async health(credentials: FollowUpBossCredentials) {
    const identity = await this.request(credentials, {
      method: "GET",
      path: "/identity",
    });
    return { authenticated: true, apiVersion: "v1", identity };
  }

  read(credentials: FollowUpBossCredentials, input: JsonObject) {
    const path = this.required(input.path, "path", 500);
    if (!this.matches(READ_ROUTES, path)) {
      throw this.validation("Follow Up Boss read endpoint is not supported.");
    }
    return this.request(credentials, {
      method: "GET",
      path,
      query: this.object(input.query),
    });
  }

  manage(credentials: FollowUpBossCredentials, input: JsonObject) {
    const method = this.required(
      input.method,
      "method",
      10,
    ).toUpperCase() as Method;
    const path = this.required(input.path, "path", 500);
    if (
      !MANAGE_ROUTES.some(
        ([allowed, pattern]) => allowed === method && pattern.test(path),
      )
    ) {
      throw this.validation("Follow Up Boss mutation endpoint is not supported.");
    }
    return this.request(credentials, {
      method,
      path,
      query: this.object(input.query),
      json: this.body(input.json),
    });
  }

  private async request(
    credentials: FollowUpBossCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonBody;
    },
  ) {
    const apiKey = this.credential(credentials.apiKey, "API key", 10_000);
    const systemName = this.headerCredential(
      credentials.systemName,
      "registered system name",
    );
    const systemKey = this.headerCredential(
      credentials.systemKey,
      "registered system key",
    );
    const permitted =
      (input.method === "GET" && this.matches(READ_ROUTES, input.path)) ||
      MANAGE_ROUTES.some(
        ([method, pattern]) =>
          method === input.method && pattern.test(input.path),
      );
    if (!permitted) throw this.validation("Follow Up Boss endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);

    const url = new URL(`https://api.followupboss.com/v1${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:`, "utf8").toString("base64")}`,
      "X-System": systemName,
      "X-System-Key": systemKey,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000) {
        throw this.validation("Follow Up Boss request exceeds 1 MB.");
      }
    }

    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000) {
        throw this.validation("Follow Up Boss response exceeds 5 MB.");
      }
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new FollowUpBossApiError(
          this.code(response.status, data),
          this.message(data) ??
            `Follow Up Boss returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof FollowUpBossApiError) throw error;
      throw new FollowUpBossApiError(
        "provider_unavailable",
        "Follow Up Boss could not be reached.",
        502,
      );
    }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw this.validation("Follow Up Boss query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_:[\].-]{1,200}$/.test(key)) {
        throw this.validation("Follow Up Boss query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("Follow Up Boss query array is too large.");
      }
      for (const child of values) {
        if (child == null) continue;
        if (!["string", "number", "boolean"].includes(typeof child)) {
          throw this.validation("Follow Up Boss query value is invalid.");
        }
        const text = String(child);
        if (
          key === "limit" &&
          (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 100)
        ) {
          throw this.validation("Follow Up Boss limit must be between 1 and 100.");
        }
        if (
          key === "offset" &&
          (!/^\d+$/.test(text) || Number(text) < 0 || Number(text) > 100_000)
        ) {
          throw this.validation(
            "Follow Up Boss offset must be between 0 and 100000.",
          );
        }
        if (key === "fields" && text.includes("allFields")) {
          throw this.validation(
            "Follow Up Boss allFields requests are not supported.",
          );
        }
        params.append(key, text.slice(0, 10_000));
      }
    }
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private body(value: unknown): JsonBody | undefined {
    return value && typeof value === "object" ? (value as JsonBody) : undefined;
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12) {
      throw new FollowUpBossApiError(
        "policy_blocked",
        "Follow Up Boss request is too deeply nested.",
      );
    }
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw new FollowUpBossApiError(
          "policy_blocked",
          "Follow Up Boss request array is too large.",
        );
      }
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 1_000) {
      throw new FollowUpBossApiError(
        "policy_blocked",
        "Follow Up Boss request object is too large.",
      );
    }
    for (const [key, child] of entries) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key|system.?key)/i.test(
          key,
        )
      ) {
        throw new FollowUpBossApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectSecrets(child, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|system.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object = this.object(value);
    const candidate =
      object?.errorMessage ??
      object?.error_message ??
      object?.message ??
      object?.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private code(
    status: number,
    value: unknown,
  ): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 402 || status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    const message = this.message(value)?.toLowerCase() ?? "";
    if (message.includes("rate limit")) return "provider_rate_limited";
    return "provider_validation_error";
  }

  private matches(patterns: RegExp[], path: string) {
    return patterns.some((pattern) => pattern.test(path));
  }

  private credential(value: unknown, label: string, maxLength: number) {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
      throw new FollowUpBossApiError(
        "credential_missing",
        `Follow Up Boss ${label} is required.`,
        401,
      );
    }
    return value.trim();
  }

  private headerCredential(value: unknown, label: string) {
    const text = this.credential(value, label, 200);
    if (!/^[A-Za-z0-9_.:@/-]{1,200}$/.test(text)) {
      throw new FollowUpBossApiError(
        "credential_missing",
        `Follow Up Boss ${label} contains unsupported characters.`,
        401,
      );
    }
    return text;
  }

  private validation(message: string) {
    return new FollowUpBossApiError("provider_validation_error", message);
  }

  private required(value: unknown, label: string, maxLength: number) {
    if (typeof value !== "string" || !value || value.length > maxLength) {
      throw this.validation(`Follow Up Boss ${label} is invalid.`);
    }
    return value;
  }
}
