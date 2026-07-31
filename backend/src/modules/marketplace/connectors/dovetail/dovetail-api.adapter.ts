import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type DovetailCredentials = { apiToken: string };
export type DovetailOperationInput = { limit?: unknown; projectId?: unknown };
export const DOVETAIL_READ_OPERATIONS = [
  "token.info",
  "projects.list",
  "project.get",
] as const;

export class DovetailApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class DovetailApiAdapter {
  health(credentials: DovetailCredentials) {
    return this.read(credentials, "token.info", {});
  }

  read(
    credentials: DovetailCredentials,
    operation: string,
    input: DovetailOperationInput,
  ) {
    this.requireCredentials(credentials);
    this.rejectUnknownInput(input);
    if (!DOVETAIL_READ_OPERATIONS.includes(operation as never))
      throw new DovetailApiError(
        "policy_blocked",
        "Dovetail operation is outside Relay's pinned metadata-only contract.",
        403,
      );
    if (operation === "token.info") {
      this.requireOnly(input, []);
      return this.request(credentials, "token/info", {}, operation);
    }
    if (operation === "project.get") {
      this.requireOnly(input, ["projectId"]);
      return this.request(
        credentials,
        `projects/${this.projectId(input.projectId)}`,
        {},
        operation,
      );
    }
    this.requireOnly(input, ["limit"]);
    return this.request(
      credentials,
      "projects",
      { "page[limit]": this.integer(input.limit, 1, 25, 20) },
      operation,
    );
  }

  private async request(
    credentials: DovetailCredentials,
    target: string,
    query: Record<string, string | number>,
    operation: string,
  ) {
    const root = new URL("https://dovetail.com/api/v1/");
    const url = new URL(target, root);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, String(value));
    if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname))
      throw new DovetailApiError(
        "policy_blocked",
        "Dovetail requests must stay on the HTTPS Public API route.",
        403,
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiToken}`,
          "User-Agent": "RelayConsole/1.0 (https://relayconsole.work)",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new DovetailApiError(
        "provider_unavailable",
        "Dovetail could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 2_500_000)
      throw this.invalid("Dovetail response exceeds Relay's 2.5 MB limit.");
    const data = this.redact(this.parse(raw));
    if (!response.ok)
      throw new DovetailApiError(
        this.safeCode(response.status),
        this.errorMessage(data) ?? `Dovetail returned HTTP ${response.status}.`,
        response.status,
      );
    if (operation === "token.info") return this.tokenInfo(data);
    return operation === "projects.list"
      ? this.projectList(data)
      : this.project(data);
  }

  private tokenInfo(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    return Object.fromEntries(
      ["id", "subdomain"]
        .filter((field) => body[field] !== undefined)
        .map((field) => [field, body[field]]),
    );
  }

  private projectList(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const body = value as JsonObject;
    const page =
      body.page && typeof body.page === "object" && !Array.isArray(body.page)
        ? (body.page as JsonObject)
        : {};
    return {
      data: Array.isArray(body.data)
        ? body.data.slice(0, 25).map((item) => this.project(item))
        : [],
      page: {
        total_count: page.total_count,
        has_more: page.has_more,
      },
    };
  }

  private project(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const item = value as JsonObject;
    const folder =
      item.folder &&
      typeof item.folder === "object" &&
      !Array.isArray(item.folder)
        ? (item.folder as JsonObject)
        : null;
    return {
      ...Object.fromEntries(
        ["id", "title", "type", "created_at", "deleted"]
          .filter((field) => item[field] !== undefined)
          .map((field) => [field, item[field]]),
      ),
      folder: folder?.id ? { id: folder.id } : null,
    };
  }

  private requireCredentials(credentials: DovetailCredentials) {
    if (
      !credentials.apiToken ||
      credentials.apiToken.length > 16_000 ||
      /[\r\n]/.test(credentials.apiToken)
    )
      throw new DovetailApiError(
        "credential_missing",
        "A valid Dovetail API token is required.",
        401,
      );
  }

  private projectId(value: unknown) {
    const id = String(value ?? "");
    if (!/^[A-Za-z0-9]{22}$/.test(id))
      throw this.invalid("projectId must be a 22-character Dovetail ID.");
    return id;
  }

  private integer(value: unknown, min: number, max: number, fallback: number) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max)
      throw this.invalid(`limit must be an integer from ${min} to ${max}.`);
    return number;
  }

  private requireOnly(input: DovetailOperationInput, allowed: string[]) {
    const present = Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);
    if (present.some((key) => !allowed.includes(key)))
      throw this.invalid(
        "Dovetail input contains fields unsupported by the selected operation.",
      );
  }

  private rejectUnknownInput(input: DovetailOperationInput) {
    const allowed = new Set(["limit", "projectId"]);
    if (Object.keys(input).some((key) => !allowed.has(key)))
      throw new DovetailApiError(
        "policy_blocked",
        "Dovetail accepts only pinned metadata operation inputs.",
        403,
      );
  }

  private parse(raw: Buffer): unknown {
    if (!raw.length) return null;
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch {
      return { message: raw.toString("utf8").slice(0, 2_000) };
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (Array.isArray(value))
      return value.slice(0, 25).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object")
      return typeof value === "string" ? value.slice(0, 1_000_000) : value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2_000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key|email|phone|url|author|people|content|transcript)/i.test(
            key,
          )
            ? "[REDACTED]"
            : this.redact(item, depth + 1),
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
    const candidate = body.message ?? body.error ?? body.detail;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private invalid(message: string) {
    return new DovetailApiError("provider_validation_error", message, 400);
  }
}
