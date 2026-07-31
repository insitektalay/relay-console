import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class InoreaderApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class InoreaderApiAdapter {
  getUserInfo(accessToken: string) {
    return this.request(accessToken, {
      method: "GET",
      path: "/reader/api/0/user-info",
    });
  }

  listSubscriptions(accessToken: string) {
    return this.request(accessToken, {
      method: "GET",
      path: "/reader/api/0/subscription/list",
      query: { output: "json" },
    });
  }

  listTags(accessToken: string) {
    return this.request(accessToken, {
      method: "GET",
      path: "/reader/api/0/tag/list",
      query: { output: "json" },
    });
  }

  streamContents(accessToken: string, input: JsonObject) {
    const streamId = this.requiredString(input.streamId, "streamId", 500);
    return this.request(accessToken, {
      method: "GET",
      path: "/reader/api/0/stream/contents",
      query: {
        s: streamId,
        n: this.clamp(input.count, 20, 1, 100),
        c: this.optionalString(input.continuation, 1000),
        ot: this.optionalInteger(input.startTime, 0, Number.MAX_SAFE_INTEGER),
        xt: this.optionalString(input.excludeTarget, 500),
        r: input.order === "oldest" ? "o" : "n",
        output: "json",
      },
    });
  }

  async request(
    accessToken: string,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      fields?: JsonObject;
    },
  ) {
    if (!accessToken) {
      throw new InoreaderApiError(
        "credential_missing",
        "Inoreader access token is required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST)$/.test(method) ||
      !/^\/reader\/(?:api\/0|atom)(?:\/[A-Za-z0-9_./:@%+-]*)?$/.test(
        input.path,
      ) ||
      input.path.includes("..") ||
      input.path.includes("//")
    ) {
      throw new InoreaderApiError(
        "provider_validation_error",
        "Inoreader method or path is invalid.",
      );
    }
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.fields);
    const body = input.fields ? this.formParams(input.fields) : undefined;
    if (body && Buffer.byteLength(body.toString()) > 1_000_000) {
      throw new InoreaderApiError(
        "provider_validation_error",
        "Inoreader request exceeds 1 MB.",
      );
    }
    const url = new URL(`https://www.inoreader.com${input.path}`);
    if (input.query) {
      for (const [key, value] of Object.entries(input.query)) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value)) {
          value.slice(0, 100).forEach((item) =>
            url.searchParams.append(key, String(item).slice(0, 10_000)),
          );
        } else {
          url.searchParams.append(key, String(value).slice(0, 10_000));
        }
      }
    }
    const response = await safeConnectorFetch(url, {
      method,
      headers: {
        Accept: "application/json, application/atom+xml, text/plain",
        Authorization: `Bearer ${accessToken}`,
        ...(body
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2_000_000) {
      throw new InoreaderApiError(
        "provider_validation_error",
        "Inoreader response exceeds 2 MB.",
      );
    }
    let data: unknown = raw;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw.slice(0, 2_000_000);
    }
    data = this.redact(data);
    if (!response.ok) {
      throw new InoreaderApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Inoreader returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private formParams(value: JsonObject) {
    const output = new URLSearchParams();
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null) continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      for (const entry of values) {
        if (!["string", "number", "boolean"].includes(typeof entry)) {
          throw new InoreaderApiError(
            "provider_validation_error",
            `Inoreader form field ${key} must be scalar or an array of scalars.`,
          );
        }
        output.append(key, String(entry).slice(0, 100_000));
      }
      if (Array.isArray(item) && item.length > 100) {
        throw new InoreaderApiError(
          "provider_validation_error",
          `Inoreader form field ${key} has too many values.`,
        );
      }
    }
    return output;
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    for (const key of Object.keys(value)) {
      if (/(token|secret|authorization|password|cookie|credential|appkey)/i.test(key)) {
        throw new InoreaderApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) {
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie)/i.test(key)
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate = body?.error ?? body?.message ?? body?.error_description;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private requiredString(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw new InoreaderApiError(
        "provider_validation_error",
        `${name} is required and must be at most ${max} characters.`,
      );
    }
    return value.trim();
  }

  private optionalString(value: unknown, max: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, max)
      : undefined;
  }

  private optionalInteger(value: unknown, min: number, max: number) {
    if (value === undefined || value === null || value === "") return undefined;
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw new InoreaderApiError(
        "provider_validation_error",
        "startTime must be a safe Unix timestamp.",
      );
    }
    return number;
  }

  private clamp(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value ?? fallback);
    return Number.isFinite(number)
      ? Math.min(Math.max(Math.floor(number), min), max)
      : fallback;
  }
}
