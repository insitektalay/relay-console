import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type NozbeCredentials = { apiKey: string };
type NozbeFile = {
  fieldName: string;
  name: string;
  mimeType: string;
  base64: string;
};

export class NozbeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class NozbeApiAdapter {
  health(credentials: NozbeCredentials) {
    return this.request(credentials, {
      method: "GET",
      path: "/teams",
      query: { limit: 1 },
    });
  }

  read(credentials: NozbeCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: "GET",
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
    });
  }

  manage(credentials: NozbeCredentials, input: JsonObject) {
    return this.request(credentials, {
      method: this.required(input.method, "method", 10),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      contentType: input.contentType === "form" ? "form" : "json",
      json: this.object(input.json),
      form: this.object(input.form),
      files: Array.isArray(input.files)
        ? (input.files as NozbeFile[])
        : undefined,
    });
  }

  async request(
    credentials: NozbeCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      contentType?: "json" | "form";
      json?: JsonObject;
      form?: JsonObject;
      files?: NozbeFile[];
    },
  ) {
    if (!credentials.apiKey?.trim() || credentials.apiKey.length > 10_000) {
      throw new NozbeApiError(
        "credential_missing",
        "Nozbe API token is required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/(?:teams|projects|tasks|task_events|comments|reminders|task_recurrences|project_accesses|project_sections|tags|tag_assignments|project_groups|group_assignments|team_members|users|csv|businesses|business_members|poll\/tasks\/(?:new|updated))(?:\/[A-Za-z0-9_.:@%+~-]+)*$/.test(
        input.path,
      ) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      input.path.includes("?") ||
      input.path.includes("#")
    ) {
      throw this.validation("Nozbe method or documented API path is invalid.");
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    this.rejectSecrets(input.form);
    const url = new URL(`https://api4.nozbe.com/v1/api${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `apikey ${credentials.apiKey.trim()}`,
    };
    let body: BodyInit | undefined;
    if (method !== "GET" && input.contentType === "form") {
      const form = new FormData();
      for (const [key, value] of Object.entries(input.form ?? {})) {
        if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) {
          throw this.validation("Nozbe form field is invalid.");
        }
        form.append(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
      let total = 0;
      if ((input.files?.length ?? 0) > 5) {
        throw this.validation("Nozbe request has too many files.");
      }
      for (const file of input.files ?? []) {
        if (
          !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(file.fieldName) ||
          !/^[^/\\\u0000-\u001f]{1,255}$/.test(file.name) ||
          !/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(file.mimeType) ||
          typeof file.base64 !== "string"
        ) {
          throw this.validation("Nozbe file metadata is invalid.");
        }
        const normalized = file.base64.replace(/\s+/g, "");
        const buffer = Buffer.from(normalized, "base64");
        if (
          !buffer.length ||
          buffer.toString("base64").replace(/=+$/, "") !==
            normalized.replace(/=+$/, "")
        ) {
          throw this.validation("Nozbe file must be valid base64.");
        }
        if (buffer.length > 4_000_000) {
          throw this.validation("Each Nozbe file must be 4 MB or less.");
        }
        total += buffer.length;
        if (total > 10_000_000) {
          throw this.validation("Nozbe request exceeds 10 MB.");
        }
        form.append(
          file.fieldName,
          new Blob([buffer], { type: file.mimeType }),
          file.name,
        );
      }
      body = form;
    } else if (method !== "GET" && input.json) {
      const raw = JSON.stringify(input.json);
      if (Buffer.byteLength(raw) > 10_000_000) {
        throw this.validation("Nozbe request exceeds 10 MB.");
      }
      headers["Content-Type"] = "application/json";
      body = raw;
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
      if (raw.byteLength > 10_000_000) {
        throw this.validation("Nozbe response exceeds 10 MB.");
      }
      const responseType = response.headers.get("content-type") ?? "";
      let data: unknown;
      if (
        /json/i.test(responseType) ||
        /^[\s]*[{[]/.test(raw.toString("utf8", 0, 20))
      ) {
        try {
          data = raw.length ? JSON.parse(raw.toString("utf8")) : null;
        } catch {
          data = raw.toString("utf8").slice(0, 1_000_000);
        }
      } else if (
        /^text\//i.test(responseType) ||
        /csv|xml/i.test(responseType)
      ) {
        data = raw.toString("utf8").slice(0, 1_000_000);
      } else {
        data = {
          contentType: responseType || "application/octet-stream",
          byteLength: raw.byteLength,
          base64: raw.toString("base64"),
        };
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new NozbeApiError(
          this.code(response.status),
          this.message(data) ?? `Nozbe returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof NozbeApiError) throw error;
      throw new NozbeApiError(
        "provider_unavailable",
        "Nozbe could not be reached.",
        502,
      );
    }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw this.validation("Nozbe query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) {
        throw this.validation("Nozbe query field is invalid.");
      }
      const entries = Array.isArray(item) ? item : [item];
      if (entries.length > 100) {
        throw this.validation("Nozbe query array is too large.");
      }
      for (const entry of entries) {
        if (entry == null || entry === "") continue;
        if (!["string", "number", "boolean"].includes(typeof entry)) {
          throw this.validation("Nozbe query value is invalid.");
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
        throw new NozbeApiError(
          "policy_blocked",
          "Nozbe request is too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 1000) {
          throw new NozbeApiError(
            "policy_blocked",
            "Nozbe request array is too large.",
          );
        }
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) {
        throw new NozbeApiError(
          "policy_blocked",
          "Nozbe request object is too large.",
        );
      }
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new NozbeApiError(
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
    return new NozbeApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
