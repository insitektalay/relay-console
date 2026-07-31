import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
import {
  HOMEBASE_OPERATION_BY_ID,
  type HomebaseOperation,
} from "./homebase-operation-registry";

type JsonObject = Record<string, unknown>;

export type HomebaseCredentials = { apiKey: string };
export type HomebaseOperationInput = {
  pathParameters?: JsonObject;
  query?: JsonObject;
};

export class HomebaseApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class HomebaseApiAdapter {
  health(credentials: HomebaseCredentials) {
    return this.read(credentials, "getCompany", {});
  }

  async read(
    credentials: HomebaseCredentials,
    operationId: string,
    input: HomebaseOperationInput,
  ) {
    this.requireCredentials(credentials);
    const operation = HOMEBASE_OPERATION_BY_ID.get(operationId);
    if (!operation) {
      throw new HomebaseApiError(
        "provider_validation_error",
        "Homebase operation is not in the pinned official public API contract.",
      );
    }
    this.rejectCredentialFields(input);
    const url = new URL(
      this.bindPath(operation, input.pathParameters ?? {}),
      "https://api.joinhomebase.com",
    );
    this.appendQuery(url, operation, input.query ?? {});

    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/vnd.homebase-v1+json",
          Authorization: `Bearer ${credentials.apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof HomebaseApiError) throw error;
      throw new HomebaseApiError(
        "provider_unavailable",
        "Homebase could not be reached.",
        502,
      );
    }

    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000) {
      throw new HomebaseApiError(
        "provider_validation_error",
        "Homebase response exceeds the 2.5 MB Relay limit.",
      );
    }
    const data = this.redact(this.parse(raw));
    if (!response.ok) {
      throw new HomebaseApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Homebase returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return {
      data,
      pagination: {
        total: this.boundedHeader(response.headers.get("total")),
        perPage: this.boundedHeader(response.headers.get("per-page")),
        link: response.headers.get("link")?.slice(0, 4_000) ?? null,
      },
    };
  }

  private bindPath(operation: HomebaseOperation, pathParameters: JsonObject) {
    this.assertExactKeys(pathParameters, operation.pathParameters, "path");
    let path = operation.path;
    for (const name of operation.pathParameters) {
      path = path.replace(
        `{${name}}`,
        this.segment(pathParameters[name], name),
      );
    }
    return path;
  }

  private appendQuery(
    url: URL,
    operation: HomebaseOperation,
    query: JsonObject,
  ) {
    this.assertExactKeys(query, operation.queryParameters, "query");
    for (const [name, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value) || typeof value === "object") {
        throw new HomebaseApiError(
          "provider_validation_error",
          `Homebase query parameter ${name} must be a scalar value.`,
        );
      }
      if (name === "per_page") {
        const perPage = Number(value);
        if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) {
          throw new HomebaseApiError(
            "provider_validation_error",
            "Homebase per_page must be an integer from 1 through 100.",
          );
        }
      }
      if (name === "page") {
        const page = Number(value);
        if (!Number.isSafeInteger(page) || page < 1 || page > 10_000) {
          throw new HomebaseApiError(
            "provider_validation_error",
            "Homebase page must be an integer from 1 through 10,000.",
          );
        }
      }
      url.searchParams.set(name, String(value).slice(0, 2_000));
    }
  }

  private assertExactKeys(
    value: JsonObject,
    allowed: readonly string[],
    label: string,
  ) {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        throw new HomebaseApiError(
          "provider_validation_error",
          `Homebase ${label} parameter ${key} is not allowed for this operation.`,
        );
      }
    }
  }

  private rejectCredentialFields(value: unknown, depth = 0) {
    if (depth > 8) {
      throw new HomebaseApiError(
        "policy_blocked",
        "Homebase request parameters are too deeply nested.",
      );
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new HomebaseApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
          403,
        );
      }
      this.rejectCredentialFields(child, depth + 1);
    }
  }

  private requireCredentials(credentials: HomebaseCredentials) {
    if (
      !credentials.apiKey ||
      credentials.apiKey.length > 4_000 ||
      /[\r\n]/.test(credentials.apiKey)
    ) {
      throw new HomebaseApiError(
        "credential_missing",
        "A valid Homebase API key is required.",
        401,
      );
    }
  }

  private segment(value: unknown, name: string) {
    const candidate = String(value ?? "").trim();
    if (
      !candidate ||
      candidate.length > 200 ||
      !/^[A-Za-z0-9_-]+$/.test(candidate)
    ) {
      throw new HomebaseApiError(
        "provider_validation_error",
        `Homebase ${name} path parameter is invalid.`,
      );
    }
    return encodeURIComponent(candidate);
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    const text = raw.toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (Array.isArray(value)) {
      return value.slice(0, 2_000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") {
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    }
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|pin)/i.test(key)
            ? "[REDACTED]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private errorMessage(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const body = value as JsonObject;
    const candidate = body.error ?? body.message ?? body.reason;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private boundedHeader(value: string | null) {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  }
}
