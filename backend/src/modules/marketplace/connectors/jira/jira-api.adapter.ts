import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export class JiraApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class JiraApiAdapter {
  health(token: string, cloudId: string) {
    return this.request(token, cloudId, {
      method: "GET",
      path: "/rest/api/3/myself",
    });
  }
  read(token: string, cloudId: string, input: JsonObject) {
    return this.request(token, cloudId, {
      method: "GET",
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
    });
  }
  manage(token: string, cloudId: string, input: JsonObject) {
    return this.request(token, cloudId, {
      method: this.required(input.method, "method", 10),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      json: this.object(input.json),
      form: this.object(input.form),
      files: Array.isArray(input.files) ? input.files : undefined,
    });
  }

  async request(
    token: string,
    cloudId: string,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
      form?: JsonObject;
      files?: unknown[];
    },
  ) {
    if (!token)
      throw new JiraApiError(
        "credential_missing",
        "Jira access token is required.",
        401,
      );
    if (!/^[A-Za-z0-9-]{1,100}$/.test(cloudId))
      throw this.validation("Jira cloud ID is invalid.");
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method))
      throw this.validation("Jira method is invalid.");
    const prefixes = [
      "/rest/api/3",
      "/rest/agile/1.0",
      "/rest/software/1.0",
      "/rest/devinfo/0.10",
      "/rest/featureflags/0.1",
      "/rest/deployments/0.1",
      "/rest/builds/0.1",
      "/rest/remotelinks/1.0",
      "/rest/security/1.0",
      "/rest/operations/1.0",
      "/rest/devopscomponents/1.0",
    ];
    if (
      !prefixes.some(
        (prefix) =>
          input.path === prefix || input.path.startsWith(`${prefix}/`),
      ) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      /[?#\\]/.test(input.path)
    )
      throw new JiraApiError(
        "policy_blocked",
        "That path is outside the documented Jira Cloud API boundary.",
      );
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    this.rejectSecrets(input.form);
    const url = new URL(
      `https://api.atlassian.com/ex/jira/${cloudId}${input.path}`,
    );
    this.appendQuery(url.searchParams, input.query);
    let body: BodyInit | undefined;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (input.files?.length) {
      if (input.files.length > 5)
        throw this.validation("A Jira upload may contain at most five files.");
      const form = new FormData();
      for (const [key, value] of Object.entries(input.form ?? {}))
        form.append(key.slice(0, 100), String(value).slice(0, 10000));
      let total = 0;
      for (const item of input.files) {
        const file = this.object(item) ?? {};
        const field = this.required(file.fieldName, "fieldName", 100);
        const filename = this.required(file.filename, "filename", 240);
        const mime = this.required(file.mimeType, "mimeType", 120);
        const base64 = this.required(file.dataBase64, "dataBase64", 14_000_000);
        if (
          /[\\/\0]/.test(filename) ||
          !/^[\w.+-]+\/[\w.+-]+$/.test(mime) ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
        )
          throw this.validation("Jira upload metadata is invalid.");
        const bytes = Buffer.from(base64, "base64");
        total += bytes.length;
        if (!bytes.length || bytes.length > 10_000_000 || total > 10_000_000)
          throw this.validation("Jira uploads may not exceed 10 MB in total.");
        form.append(
          field,
          new Blob([new Uint8Array(bytes)], { type: mime }),
          filename,
        );
      }
      body = form;
      headers["X-Atlassian-Token"] = "no-check";
    } else if (input.json) {
      const encoded = JSON.stringify(input.json);
      if (Buffer.byteLength(encoded) > 2_000_000)
        throw this.validation("Jira JSON requests may not exceed 2 MB.");
      body = encoded;
      headers["Content-Type"] = "application/json";
    } else if (input.form) {
      const encoded = new URLSearchParams(
        Object.fromEntries(
          Object.entries(input.form).map(([k, v]) => [k, String(v)]),
        ),
      );
      if (Buffer.byteLength(encoded.toString()) > 2_000_000)
        throw this.validation("Jira form requests may not exceed 2 MB.");
      body = encoded;
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new JiraApiError(
        "provider_unavailable",
        "Jira could not be reached.",
      );
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10_000_000)
      throw this.validation("Jira returned more than 10 MB.");
    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";
    let data: unknown;
    if (/json/i.test(contentType)) {
      try {
        data = bytes.length ? JSON.parse(bytes.toString("utf8")) : null;
      } catch {
        throw new JiraApiError(
          "provider_unavailable",
          "Jira returned invalid JSON.",
          response.status,
        );
      }
      data = this.redact(data);
    } else if (/^text\//i.test(contentType)) data = bytes.toString("utf8");
    else
      data = {
        contentType,
        bytes: bytes.length,
        dataBase64: bytes.toString("base64"),
      };
    if (!response.ok)
      throw new JiraApiError(
        this.code(response.status),
        this.message(data) ?? `Jira returned HTTP ${response.status}.`,
        response.status,
      );
    return data;
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw this.validation("Jira query has too many fields.");
    for (const [key, raw] of Object.entries(value)) {
      if (raw == null || raw === "") continue;
      const values = Array.isArray(raw) ? raw.slice(0, 100) : [raw];
      for (const item of values) {
        let text = String(item).slice(0, 10000);
        if (/^(maxResults|limit|pageSize|max-results)$/i.test(key))
          text = String(
            Math.max(1, Math.min(100, Number.parseInt(text, 10) || 100)),
          );
        params.append(key, text);
      }
    }
  }
  private rejectSecrets(value?: JsonObject) {
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new JiraApiError(
          "policy_blocked",
          "Jira request is too deeply nested.",
        );
      if (Array.isArray(item)) {
        if (item.length > 100)
          throw this.validation("Jira arrays may contain at most 100 items.");
        return item.forEach((v) => walk(v, depth + 1));
      }
      if (!item || typeof item !== "object") return;
      for (const [key, child] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new JiraApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
          );
        walk(child, depth + 1);
      }
    };
    if (value) walk(value);
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 1_000_000);
    if (Array.isArray(value))
      return value.slice(0, 1000).map((v) => this.redact(v, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([k, v]) => [
          k,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            k,
          )
            ? "[redacted]"
            : this.redact(v, depth + 1),
        ]),
    );
  }
  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }
  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max)
      throw this.validation(`${name} is required.`);
    return value.trim();
  }
  private validation(message: string) {
    return new JiraApiError("provider_validation_error", message);
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private message(value: unknown) {
    const object = this.object(value);
    const messages = Array.isArray(object?.errorMessages)
      ? object?.errorMessages
      : [];
    const first = messages.find((item) => typeof item === "string");
    const fallback = object?.message ?? object?.error ?? object?.detail;
    return typeof first === "string"
      ? first.slice(0, 500)
      : typeof fallback === "string"
        ? fallback.slice(0, 500)
        : null;
  }
}
