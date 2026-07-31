import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export type JiraAlignCredentials = {
  siteUrl: string;
  email: string;
  apiToken: string;
};

export class JiraAlignApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

const RESOURCES = new Map<string, { create: boolean; update: boolean }>(
  [
    "themes",
    "epics",
    "capabilities",
    "features",
    "stories",
    "tasks",
    "defects",
    "risks",
    "goals",
    "objectives",
    "keyresults",
    "programs",
    "teams",
    "users",
    "releases",
    "releasevehicles",
    "iterations",
    "products",
    "snapshots",
    "regions",
    "cities",
  ].map((name) => [name, { create: true, update: true }]),
);
for (const name of ["portfolios", "valuestreams", "customers", "ideas"])
  RESOURCES.set(name, { create: true, update: false });

@Injectable()
export class JiraAlignApiAdapter {
  health(credentials: JiraAlignCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/Epics",
      query: { $top: 1, $select: "id,title" },
    });
  }

  async request(
    credentials: JiraAlignCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const origin = this.validatedOrigin(credentials.siteUrl);
    const email = credentials.email?.trim();
    const apiToken = credentials.apiToken?.trim();
    if (
      !email ||
      email.length > 320 ||
      !email.includes("@") ||
      !apiToken ||
      apiToken.length > 20_000
    )
      throw new JiraAlignApiError(
        "credential_missing",
        "Jira Align account email and Atlassian API token are required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (!this.routeAllowed(method, input.path))
      throw new JiraAlignApiError(
        "provider_validation_error",
        "Jira Align method or route is outside Relay's documented API 2.0 surface.",
      );
    if (method === "GET" && input.json)
      throw new JiraAlignApiError(
        "provider_validation_error",
        "Jira Align GET requests cannot include a body.",
      );
    if (method !== "GET" && !input.json)
      throw new JiraAlignApiError(
        "provider_validation_error",
        "Jira Align create and update requests require a JSON body.",
      );
    this.rejectCredentials(input.query);
    this.rejectCredentials(input.json);

    const url = new URL(`/rest/align/api/2${input.path}`, origin);
    this.appendQuery(url.searchParams, input.query ?? {});
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000)
      throw new JiraAlignApiError(
        "provider_validation_error",
        "Jira Align request exceeds 1 MB.",
      );

    try {
      const response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.length > 10_000_000)
        throw new JiraAlignApiError(
          "provider_validation_error",
          "Jira Align response exceeds 10 MB.",
        );
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      data = this.redact(data);
      if (!response.ok)
        throw new JiraAlignApiError(
          this.safeCode(response.status),
          this.message(data) ?? `Jira Align returned HTTP ${response.status}.`,
          response.status,
        );
      return {
        status: response.status,
        data,
        rateLimit: {
          remaining: response.headers.get("x-ratelimit-remaining"),
          retryAfter: response.headers.get("retry-after"),
        },
      };
    } catch (error) {
      if (error instanceof JiraAlignApiError) throw error;
      throw new JiraAlignApiError(
        "provider_unavailable",
        "Jira Align could not be reached.",
        502,
      );
    }
  }

  private validatedOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value?.trim());
    } catch {
      throw new JiraAlignApiError(
        "credential_missing",
        "A valid Jira Align HTTPS site URL is required.",
        401,
      );
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/(?:^|\.)(?:jiraalign\.com|agilecraft\.com)$/.test(host)
    )
      throw new JiraAlignApiError(
        "credential_missing",
        "Jira Align site URL must be an HTTPS jiraalign.com or agilecraft.com origin.",
        401,
      );
    return url.origin;
  }

  private routeAllowed(method: string, path: string) {
    if (
      !path.startsWith("/") ||
      path.includes("?") ||
      path.includes("#") ||
      path.includes("..") ||
      path.includes("//") ||
      path.length > 500
    )
      return false;
    const match = /^\/([A-Za-z]+)(?:\/([1-9][0-9]{0,18}))?\/?$/.exec(path);
    if (!match) return false;
    const resource = RESOURCES.get(match[1].toLowerCase());
    if (!resource) return false;
    if (method === "GET") return true;
    if (method === "POST") return resource.create && !match[2];
    if (method === "PUT" || method === "PATCH")
      return resource.update && Boolean(match[2]);
    return false;
  }

  private appendQuery(params: URLSearchParams, query: JsonObject) {
    if (Object.keys(query).length > 20)
      throw new JiraAlignApiError(
        "provider_validation_error",
        "Jira Align request has too many query fields.",
      );
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (!/^\$?(?:select|top|skip|filter|orderby|expand)$/i.test(key))
        throw new JiraAlignApiError(
          "provider_validation_error",
          `Jira Align query field ${key} is not allowed.`,
        );
      if (!["string", "number", "boolean"].includes(typeof value))
        throw new JiraAlignApiError(
          "provider_validation_error",
          `Jira Align query field ${key} must be scalar.`,
        );
      params.set(key, String(value).slice(0, 10_000));
    }
  }

  private rejectCredentials(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new JiraAlignApiError(
          "policy_blocked",
          "Jira Align request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return item.slice(0, 1000).forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new JiraAlignApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    if (value) walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 2_000_000);
    if (Array.isArray(value))
      return value.slice(0, 2000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 2000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|api.?key|login.?url)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private message(value: unknown) {
    const body =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
    const candidate = body?.message ?? body?.error ?? body?.title;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
