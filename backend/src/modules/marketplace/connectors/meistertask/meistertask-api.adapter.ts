import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type MeisterTaskFile = {
  fieldName: string;
  name: string;
  mimeType: string;
  base64: string;
};

export class MeisterTaskApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class MeisterTaskApiAdapter {
  health(token: string) {
    return this.request(token, { method: "GET", path: "/api/persons/me" });
  }

  read(token: string, input: JsonObject) {
    return this.request(token, {
      method: "GET",
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
    });
  }

  manage(token: string, input: JsonObject) {
    return this.request(token, {
      method: this.required(input.method, "method", 10),
      path: this.required(input.path, "path", 2000),
      query: this.object(input.query),
      contentType: input.contentType === "form" ? "form" : "json",
      json: this.object(input.json),
      form: this.object(input.form),
      files: Array.isArray(input.files)
        ? (input.files as MeisterTaskFile[])
        : undefined,
    });
  }

  async request(
    token: string,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      contentType?: "json" | "form";
      json?: JsonObject;
      form?: JsonObject;
      files?: MeisterTaskFile[];
    },
  ) {
    if (!token?.trim() || token.length > 10_000) {
      throw new MeisterTaskApiError(
        "credential_missing",
        "MeisterTask access token is required.",
        401,
      );
    }
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|DELETE)$/.test(method) ||
      !/^\/api\/(?:persons|projects|sections|tasks|attachments|checklists|checklist_items|comments|custom_fields|custom_field_types|dropdown_items|labels|project_images|project_rights|project_memberships|project_settings|groups|task_labels|task_relationships|task_subscriptions|timeline_items|work_intervals)(?:\/[A-Za-z0-9_.:@%+~-]+)*$/.test(
        input.path,
      ) ||
      input.path.includes("..") ||
      input.path.includes("//") ||
      input.path.includes("?") ||
      input.path.includes("#")
    ) {
      throw this.validation(
        "MeisterTask method or documented API path is invalid.",
      );
    }
    this.rejectSecrets(input.query);
    this.rejectSecrets(input.json);
    this.rejectSecrets(input.form);
    const url = new URL(`https://www.meistertask.com${input.path}`);
    this.appendQuery(url.searchParams, input.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    let body: BodyInit | undefined;
    if (method !== "GET" && input.contentType === "form") {
      const form = new FormData();
      for (const [key, value] of Object.entries(input.form ?? {})) {
        if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) {
          throw this.validation("MeisterTask form field is invalid.");
        }
        form.append(
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        );
      }
      let total = 0;
      if ((input.files?.length ?? 0) > 5) {
        throw this.validation("MeisterTask request has too many files.");
      }
      for (const file of input.files ?? []) {
        if (
          !/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(file.fieldName) ||
          !/^[^/\\\u0000-\u001f]{1,255}$/.test(file.name) ||
          !/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(file.mimeType) ||
          typeof file.base64 !== "string"
        ) {
          throw this.validation("MeisterTask file metadata is invalid.");
        }
        const normalized = file.base64.replace(/\s+/g, "");
        const buffer = Buffer.from(normalized, "base64");
        if (
          !buffer.length ||
          buffer.toString("base64").replace(/=+$/, "") !==
            normalized.replace(/=+$/, "")
        ) {
          throw this.validation("MeisterTask file must be valid base64.");
        }
        if (buffer.length > 4_000_000) {
          throw this.validation("Each MeisterTask file must be 4 MB or less.");
        }
        total += buffer.length;
        if (total > 10_000_000) {
          throw this.validation("MeisterTask request exceeds 10 MB.");
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
        throw this.validation("MeisterTask request exceeds 10 MB.");
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
      const raw = await response.text();
      if (Buffer.byteLength(raw) > 10_000_000) {
        throw this.validation("MeisterTask response exceeds 10 MB.");
      }
      let data: unknown = raw;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw.slice(0, 1_000_000);
      }
      data = this.redact(data);
      if (!response.ok) {
        throw new MeisterTaskApiError(
          this.code(response.status),
          this.message(data) ?? `MeisterTask returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof MeisterTaskApiError) throw error;
      throw new MeisterTaskApiError(
        "provider_unavailable",
        "MeisterTask could not be reached.",
        502,
      );
    }
  }

  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50) {
      throw this.validation("MeisterTask query has too many fields.");
    }
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z0-9_.\[\]-]{1,100}$/.test(key)) {
        throw this.validation("MeisterTask query field is invalid.");
      }
      const entries = Array.isArray(item) ? item : [item];
      if (entries.length > 100) {
        throw this.validation("MeisterTask query array is too large.");
      }
      for (const entry of entries) {
        if (entry == null || entry === "") continue;
        if (!["string", "number", "boolean"].includes(typeof entry)) {
          throw this.validation("MeisterTask query value is invalid.");
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
        throw new MeisterTaskApiError(
          "policy_blocked",
          "MeisterTask request is too deeply nested.",
        );
      }
      if (Array.isArray(item)) {
        if (item.length > 1000) {
          throw new MeisterTaskApiError(
            "policy_blocked",
            "MeisterTask request array is too large.",
          );
        }
        item.forEach((child) => walk(child, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      const entries = Object.entries(item as JsonObject);
      if (entries.length > 1000) {
        throw new MeisterTaskApiError(
          "policy_blocked",
          "MeisterTask request object is too large.",
        );
      }
      for (const [key, child] of entries) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new MeisterTaskApiError(
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
    return new MeisterTaskApiError("provider_validation_error", message);
  }

  private required(value: unknown, name: string, max: number) {
    if (typeof value !== "string" || !value.trim() || value.length > max) {
      throw this.validation(`${name} is required.`);
    }
    return value.trim();
  }
}
