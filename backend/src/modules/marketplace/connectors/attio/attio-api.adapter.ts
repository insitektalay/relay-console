import { Injectable, Optional } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type AttioCredentials = { accessToken: string; workspaceId: string };

const UUID =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const IDENTIFIER = `(?:${UUID}|[a-z0-9][a-z0-9_-]{0,199})`;
const ATTRIBUTE = `(?:${UUID}|[A-Za-z0-9][A-Za-z0-9_-]{0,199})`;

const READ_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["GET", /^\/v2\/objects$/],
  ["GET", new RegExp(`^/v2/objects/${IDENTIFIER}$`)],
  ["GET", new RegExp(`^/v2/(?:objects|lists)/${IDENTIFIER}/attributes$`)],
  [
    "GET",
    new RegExp(`^/v2/(?:objects|lists)/${IDENTIFIER}/attributes/${ATTRIBUTE}$`),
  ],
  ["GET", new RegExp(`^/v2/objects/${IDENTIFIER}/records/${UUID}$`)],
  [
    "GET",
    new RegExp(
      `^/v2/objects/${IDENTIFIER}/records/${UUID}/attributes/${ATTRIBUTE}/values$`,
    ),
  ],
  ["GET", new RegExp(`^/v2/objects/${IDENTIFIER}/records/${UUID}/entries$`)],
  ["POST", new RegExp(`^/v2/objects/${IDENTIFIER}/records/query$`)],
  ["GET", /^\/v2\/lists$/],
  ["GET", new RegExp(`^/v2/lists/${IDENTIFIER}$`)],
  ["GET", new RegExp(`^/v2/lists/${IDENTIFIER}/entries/${UUID}$`)],
  ["POST", new RegExp(`^/v2/lists/${IDENTIFIER}/entries/query$`)],
  ["GET", /^\/v2\/workspace_members$/],
  ["GET", new RegExp(`^/v2/workspace_members/${UUID}$`)],
  ["GET", /^\/v2\/notes$/],
  ["GET", new RegExp(`^/v2/notes/${UUID}$`)],
  ["GET", /^\/v2\/tasks$/],
  ["GET", new RegExp(`^/v2/tasks/${UUID}$`)],
  ["GET", /^\/v2\/threads$/],
  ["GET", new RegExp(`^/v2/threads/${UUID}$`)],
  ["GET", /^\/v2\/webhooks$/],
  ["GET", new RegExp(`^/v2/webhooks/${UUID}$`)],
];

const MANAGE_ROUTES: ReadonlyArray<[Method, RegExp]> = [
  ["POST", new RegExp(`^/v2/objects/${IDENTIFIER}/records$`)],
  ["PUT", new RegExp(`^/v2/objects/${IDENTIFIER}/records$`)],
  ["PUT", new RegExp(`^/v2/objects/${IDENTIFIER}/records/${UUID}$`)],
  ["PATCH", new RegExp(`^/v2/objects/${IDENTIFIER}/records/${UUID}$`)],
  ["DELETE", new RegExp(`^/v2/objects/${IDENTIFIER}/records/${UUID}$`)],
  ["POST", new RegExp(`^/v2/lists/${IDENTIFIER}/entries$`)],
  ["PUT", new RegExp(`^/v2/lists/${IDENTIFIER}/entries$`)],
  ["PUT", new RegExp(`^/v2/lists/${IDENTIFIER}/entries/${UUID}$`)],
  ["PATCH", new RegExp(`^/v2/lists/${IDENTIFIER}/entries/${UUID}$`)],
  ["DELETE", new RegExp(`^/v2/lists/${IDENTIFIER}/entries/${UUID}$`)],
  ["POST", /^\/v2\/notes$/],
  ["DELETE", new RegExp(`^/v2/notes/${UUID}$`)],
  ["POST", /^\/v2\/tasks$/],
  ["PATCH", new RegExp(`^/v2/tasks/${UUID}$`)],
  ["DELETE", new RegExp(`^/v2/tasks/${UUID}$`)],
  ["POST", /^\/v2\/webhooks$/],
  ["PATCH", new RegExp(`^/v2/webhooks/${UUID}$`)],
  ["DELETE", new RegExp(`^/v2/webhooks/${UUID}$`)],
];

export class AttioApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class AttioApiAdapter {
  constructor(@Optional() private readonly requester: Requester = fetch) {}

  async health(credentials: AttioCredentials) {
    this.credentials(credentials);
    const response = await this.send("https://app.attio.com/oauth/introspect", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    const body = this.object(response);
    if (
      body.active !== true ||
      body.workspace_id !== credentials.workspaceId ||
      typeof body.authorized_by_workspace_member_id !== "string"
    ) {
      throw new AttioApiError(
        "insufficient_scope",
        "Attio token workspace or authorizing-member binding changed.",
        403,
      );
    }
    return {
      active: true,
      workspaceId: credentials.workspaceId,
      workspaceName: this.text(body.workspace_name, 200),
      workspaceSlug: this.text(body.workspace_slug, 200),
      authorizedByWorkspaceMemberId: body.authorized_by_workspace_member_id,
      scopes: typeof body.scope === "string" ? body.scope.split(/\s+/) : [],
    };
  }

  async read(credentials: AttioCredentials, input: JsonObject) {
    const method = this.method(input.method);
    const path = this.required(input.path, "path", 2_000);
    if (!this.allowed(READ_ROUTES, method, path)) {
      throw this.validation("Attio read endpoint is not supported.");
    }
    return await this.request(credentials, {
      method,
      path,
      query: this.objectOrUndefined(input.query),
      json: this.objectOrUndefined(input.json),
    });
  }

  async manage(credentials: AttioCredentials, input: JsonObject) {
    const method = this.method(input.method);
    const path = this.required(input.path, "path", 2_000);
    if (!this.allowed(MANAGE_ROUTES, method, path)) {
      throw this.validation("Attio mutation endpoint is not supported.");
    }
    return await this.request(credentials, {
      method,
      path,
      query: this.objectOrUndefined(input.query),
      json: this.objectOrUndefined(input.json),
    });
  }

  private async request(
    credentials: AttioCredentials,
    input: {
      method: Method;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    this.credentials(credentials);
    const permitted =
      this.allowed(READ_ROUTES, input.method, input.path) ||
      this.allowed(MANAGE_ROUTES, input.method, input.path);
    if (!permitted) throw this.validation("Attio endpoint is invalid.");
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    this.enforceBounds(input.json);
    const url = new URL(`https://api.attio.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${credentials.accessToken}`,
    };
    let body: string | undefined;
    if (input.json && input.method !== "GET" && input.method !== "DELETE") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(input.json);
      if (Buffer.byteLength(body) > 1_000_000) {
        throw this.validation("Attio request exceeds 1 MB.");
      }
    }
    const data = await this.send(url, {
      method: input.method,
      headers,
      body,
    });
    this.assertWorkspace(data, credentials.workspaceId);
    return this.redact(data);
  }

  private async send(url: string | URL, init: RequestInit) {
    let response: Response;
    try {
      response = await this.requester(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new AttioApiError(
        "provider_unavailable",
        "Attio could not be reached.",
        502,
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.byteLength > 5_000_000) {
      throw this.validation("Attio response exceeds 5 MB.");
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
      throw new AttioApiError(
        this.code(response.status),
        this.message(data) ?? `Attio returned HTTP ${response.status}.`,
        response.status,
      );
    }
    return data;
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 30) {
      throw this.validation("Attio query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(key)) {
        throw this.validation("Attio query field is invalid.");
      }
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100) {
        throw this.validation("Attio query array is too large.");
      }
      for (const child of values) {
        if (!["string", "number", "boolean"].includes(typeof child)) {
          throw this.validation("Attio query value is invalid.");
        }
        const text = String(child);
        if (
          key === "limit" &&
          (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 100)
        ) {
          throw this.validation("Attio limit must be between 1 and 100.");
        }
        if (
          key === "offset" &&
          (!/^\d+$/.test(text) || Number(text) < 0 || Number(text) > 10_000)
        ) {
          throw this.validation("Attio offset must be between 0 and 10000.");
        }
        params.append(key, text.slice(0, 10_000));
      }
    }
  }

  private enforceBounds(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12)
      throw this.validation("Attio request is too deeply nested.");
    if (Array.isArray(value)) {
      if (value.length > 100)
        throw this.validation("Attio request array is too large.");
      value.forEach((child) => this.enforceBounds(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const entries = Object.entries(value as JsonObject);
    if (entries.length > 500)
      throw this.validation("Attio request object is too large.");
    for (const [key, child] of entries) {
      if (
        key === "limit" &&
        (!Number.isSafeInteger(child) ||
          Number(child) < 1 ||
          Number(child) > 100)
      )
        throw this.validation("Attio body limit must be between 1 and 100.");
      if (
        key === "offset" &&
        (!Number.isSafeInteger(child) ||
          Number(child) < 0 ||
          Number(child) > 10_000)
      )
        throw this.validation("Attio body offset must be between 0 and 10000.");
      if (key === "sorts" && Array.isArray(child) && child.length > 5)
        throw this.validation("Attio permits at most five sorts.");
      this.enforceBounds(child, depth + 1);
    }
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null || depth > 12) return;
    if (Array.isArray(value)) {
      value.forEach((child) => this.rejectSecrets(child, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
      ) {
        throw new AttioApiError(
          "policy_blocked",
          `Credential-bearing field ${key} is not allowed.`,
        );
      }
      this.rejectSecrets(child, depth + 1);
    }
  }

  private assertWorkspace(value: unknown, workspaceId: string, depth = 0) {
    if (value == null || depth > 20) return;
    if (Array.isArray(value)) {
      value.forEach((child) =>
        this.assertWorkspace(child, workspaceId, depth + 1),
      );
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as JsonObject)) {
      if (key === "workspace_id" && child !== workspaceId) {
        throw new AttioApiError(
          "insufficient_scope",
          "Attio returned data outside the connected workspace.",
          403,
        );
      }
      this.assertWorkspace(child, workspaceId, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1_000)
        .map(([key, child]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(child, depth + 1),
        ]),
    );
  }

  private credentials(value: AttioCredentials) {
    if (!value.accessToken?.trim() || value.accessToken.length > 10_000)
      throw new AttioApiError(
        "credential_missing",
        "Attio OAuth token is required.",
        401,
      );
    if (!new RegExp(`^${UUID}$`).test(value.workspaceId))
      throw this.validation("Attio workspace binding is invalid.");
  }
  private allowed(
    routes: ReadonlyArray<[Method, RegExp]>,
    method: Method,
    path: string,
  ) {
    return routes.some(
      ([candidate, pattern]) => candidate === method && pattern.test(path),
    );
  }
  private method(value: unknown): Method {
    if (
      typeof value !== "string" ||
      !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(value.toUpperCase())
    )
      throw this.validation("Attio method is invalid.");
    return value.toUpperCase() as Method;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private objectOrUndefined(value: unknown): JsonObject | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }
  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }
  private message(value: unknown) {
    if (typeof value === "string") return value.slice(0, 500);
    const object = this.object(value);
    return typeof object.message === "string"
      ? object.message.slice(0, 500)
      : null;
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private validation(message: string) {
    return new AttioApiError("provider_validation_error", message);
  }
}
