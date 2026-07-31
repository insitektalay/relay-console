import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type SuiteCrmCloudCredentials = {
  host: string;
  clientId: string;
  clientSecret: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;
const MODULES = new Set([
  "Accounts",
  "AOS_Contracts",
  "AOS_Invoices",
  "AOS_Products",
  "AOS_Quotes",
  "Calls",
  "Campaigns",
  "Cases",
  "Contacts",
  "Documents",
  "Leads",
  "Meetings",
  "Notes",
  "Opportunities",
  "Project",
  "ProjectTask",
  "Prospects",
  "Tasks",
]);
const FILTER_OPERATORS = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);
const READ_OPERATIONS = new Set([
  "modules",
  "fields",
  "list",
  "retrieve",
  "relationship",
]);
const MANAGE_OPERATIONS = new Set([
  "create",
  "update",
  "delete",
  "link",
  "unlink",
]);

export class SuiteCrmCloudApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SuiteCrmCloudApiAdapter {
  async health(credentials: SuiteCrmCloudCredentials) {
    const modules = await this.apiRequest(credentials, {
      method: "GET",
      path: "/meta/modules",
    });
    return { oauthVerified: true, apiVersion: "V8", modules };
  }

  read(credentials: SuiteCrmCloudCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, READ_OPERATIONS);
    const module = operation === "modules" ? null : this.module(input.module);
    switch (operation) {
      case "modules":
        return this.apiRequest(credentials, {
          method: "GET",
          path: "/meta/modules",
        });
      case "fields":
        return this.apiRequest(credentials, {
          method: "GET",
          path: `/meta/fields/${module}`,
        });
      case "list":
        return this.apiRequest(credentials, {
          method: "GET",
          path: `/module/${module}`,
          query: this.collectionQuery(module!, input),
        });
      case "retrieve":
        return this.apiRequest(credentials, {
          method: "GET",
          path: `/module/${module}/${this.id(input.id)}`,
          query: this.fieldQuery(module!, input.fields),
        });
      case "relationship":
        return this.apiRequest(credentials, {
          method: "GET",
          path: `/module/${module}/${this.id(input.id)}/relationships/${this.field(input.linkField, "linkField")}`,
          query: this.pageQuery(input),
        });
    }
  }

  manage(credentials: SuiteCrmCloudCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, MANAGE_OPERATIONS);
    const module = this.module(input.module);
    switch (operation) {
      case "create":
        return this.apiRequest(credentials, {
          method: "POST",
          path: "/module",
          json: {
            data: {
              type: module,
              attributes: this.attributes(input.attributes),
            },
          },
        });
      case "update":
        return this.apiRequest(credentials, {
          method: "PATCH",
          path: "/module",
          json: {
            data: {
              type: module,
              id: this.id(input.id),
              attributes: this.attributes(input.attributes),
            },
          },
        });
      case "delete":
        return this.apiRequest(credentials, {
          method: "DELETE",
          path: `/module/${module}/${this.id(input.id)}`,
        });
      case "link": {
        const relatedModule = this.module(input.relatedModule, "relatedModule");
        return this.apiRequest(credentials, {
          method: "POST",
          path: `/module/${module}/${this.id(input.id)}/relationships/${this.field(input.linkField, "linkField")}`,
          json: {
            data: {
              type: relatedModule,
              id: this.id(input.relatedId, "relatedId"),
            },
          },
        });
      }
      case "unlink":
        return this.apiRequest(credentials, {
          method: "DELETE",
          path: `/module/${module}/${this.id(input.id)}/relationships/${this.field(input.linkField, "linkField")}/${this.id(input.relatedId, "relatedId")}`,
        });
    }
  }

  private async apiRequest(
    credentials: SuiteCrmCloudCredentials,
    input: {
      method: Method;
      path: string;
      query?: URLSearchParams;
      json?: JsonObject;
    },
  ) {
    const origin = this.origin(credentials.host);
    if (
      !/^\/(?:meta\/(?:modules|fields\/[A-Za-z][A-Za-z0-9_]{0,99})|module(?:\/[A-Za-z][A-Za-z0-9_]{0,99}(?:\/[0-9a-f-]{36}(?:\/relationships\/[A-Za-z][A-Za-z0-9_]{0,99}(?:\/[0-9a-f-]{36})?)?)?)?)$/i.test(
        input.path,
      ) ||
      input.path.includes("..")
    ) {
      throw this.validation("SuiteCRM Cloud API path is invalid.");
    }
    this.rejectSecrets(input.json);
    this.assertShape(input.json);
    const token = await this.accessToken(credentials, origin);
    const url = new URL(`${origin}/Api/V8${input.path}`);
    input.query?.forEach((value, key) => url.searchParams.append(key, value));
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw this.validation("SuiteCRM Cloud request exceeds 1 MB.");
    }
    return this.fetchJson(url, {
      method: input.method,
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  }

  private async accessToken(
    credentials: SuiteCrmCloudCredentials,
    origin: string,
  ) {
    const clientId = this.credential(credentials.clientId, "OAuth client ID");
    const clientSecret = this.credential(
      credentials.clientSecret,
      "OAuth client secret",
    );
    const result = await this.fetchJson(
      new URL(`${origin}/Api/access_token`),
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
        },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
      false,
    );
    const object = this.object(result);
    const token =
      typeof object?.access_token === "string" ? object.access_token : null;
    if (!token || token.length > 20_000) {
      throw new SuiteCrmCloudApiError(
        "token_refresh_failed",
        "SuiteCRM Cloud did not return a usable OAuth access token.",
        401,
      );
    }
    return token;
  }

  private async fetchJson(url: URL, init: RequestInit, redactResponse = true) {
    try {
      const response = await safeConnectorFetch(url, init);
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000) {
        throw this.validation("SuiteCRM Cloud response exceeds 5 MB.");
      }
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      if (!response.ok) {
        const safeData = this.redact(data);
        throw new SuiteCrmCloudApiError(
          this.code(response.status),
          this.message(safeData) ??
            `SuiteCRM Cloud returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return redactResponse ? this.redact(data) : data;
    } catch (error) {
      if (error instanceof SuiteCrmCloudApiError) throw error;
      throw new SuiteCrmCloudApiError(
        "provider_unavailable",
        "SuiteCRM Cloud could not be reached.",
        502,
      );
    }
  }

  private origin(value: unknown) {
    const host = this.required(value, "host", 253).toLowerCase();
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:suitecrm|suiteondemand)\.com$/.test(
        host,
      )
    ) {
      throw new SuiteCrmCloudApiError(
        "policy_blocked",
        "SuiteCRM Cloud host must be an exact official hosted suitecrm.com or suiteondemand.com subdomain.",
        403,
      );
    }
    return `https://${host}`;
  }

  private collectionQuery(module: string, input: JsonObject) {
    const params = this.fieldQuery(module, input.fields);
    const page = this.pageQuery(input);
    page.forEach((value, key) => params.append(key, value));
    if (input.sortField != null) {
      const sortField = this.field(input.sortField, "sortField");
      const direction =
        input.sortDirection == null
          ? "ASC"
          : this.enumValue(input.sortDirection, "sortDirection", [
              "ASC",
              "DESC",
            ]);
      params.set("sort", `${direction === "DESC" ? "-" : ""}${sortField}`);
    }
    const filters = this.object(input.filters);
    if (filters) {
      if (Object.keys(filters).length > 25)
        throw this.validation("SuiteCRM Cloud filters are too numerous.");
      params.set("filter[operator]", "and");
      for (const [fieldName, conditionValue] of Object.entries(filters)) {
        const field = this.field(fieldName, "filter field");
        const condition = this.object(conditionValue);
        if (!condition || Object.keys(condition).length !== 1) {
          throw this.validation(
            "SuiteCRM Cloud filter condition must have one operator.",
          );
        }
        const [operator, value] = Object.entries(condition)[0];
        if (!FILTER_OPERATORS.has(operator)) {
          throw this.validation(
            "SuiteCRM Cloud filter operator is not supported.",
          );
        }
        if (!this.scalar(value))
          throw this.validation("SuiteCRM Cloud filter value must be scalar.");
        params.set(
          `filter[${field}][${operator}]`,
          String(value).slice(0, 2_000),
        );
      }
    }
    return params;
  }

  private fieldQuery(module: string, value: unknown) {
    const params = new URLSearchParams();
    const fields = this.stringArray(value, "fields", 50).map((item) =>
      this.field(item, "fields"),
    );
    if (fields.length) params.set(`fields[${module}]`, fields.join(","));
    return params;
  }

  private pageQuery(input: JsonObject) {
    const params = new URLSearchParams();
    const pageNumber =
      input.pageNumber == null
        ? 1
        : this.integer(input.pageNumber, "pageNumber", 1, 10_000);
    const pageSize =
      input.pageSize == null
        ? 100
        : this.integer(input.pageSize, "pageSize", 1, 100);
    params.set("page[number]", String(pageNumber));
    params.set("page[size]", String(pageSize));
    return params;
  }

  private attributes(value: unknown) {
    const attributes = this.object(value);
    if (
      !attributes ||
      !Object.keys(attributes).length ||
      Object.keys(attributes).length > 200
    ) {
      throw this.validation(
        "SuiteCRM Cloud attributes must contain 1 to 200 fields.",
      );
    }
    for (const key of Object.keys(attributes))
      this.field(key, "attribute field");
    this.rejectSecrets(attributes);
    this.assertShape(attributes);
    return attributes;
  }

  private module(value: unknown, label = "module") {
    const module = this.required(value, label, 100);
    if (!MODULES.has(module)) {
      throw this.validation(
        `SuiteCRM Cloud ${label} is outside the selected modules.`,
      );
    }
    return module;
  }

  private field(value: unknown, label: string) {
    const field = this.required(value, label, 100);
    if (!FIELD.test(field))
      throw this.validation(`SuiteCRM Cloud ${label} is invalid.`);
    return field;
  }

  private id(value: unknown, label = "id") {
    const id = this.required(value, label, 36);
    if (!UUID.test(id))
      throw this.validation(`SuiteCRM Cloud ${label} is invalid.`);
    return id;
  }

  private operation(value: unknown, allowed: Set<string>) {
    const operation = this.required(value, "operation", 50).toLowerCase();
    if (!allowed.has(operation))
      throw this.validation("SuiteCRM Cloud operation is not supported.");
    return operation;
  }

  private credential(value: unknown, label: string) {
    const text = this.required(value, label, 10_000);
    if (/[\r\n]/.test(text)) {
      throw new SuiteCrmCloudApiError(
        "credential_missing",
        `SuiteCRM Cloud ${label} is invalid.`,
        401,
      );
    }
    return text;
  }

  private enumValue(value: unknown, label: string, values: string[]) {
    const text = this.required(value, label, 20);
    if (!values.includes(text))
      throw this.validation(`SuiteCRM Cloud ${label} is invalid.`);
    return text;
  }

  private integer(value: unknown, label: string, min: number, max: number) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw this.validation(
        `SuiteCRM Cloud ${label} must be between ${min} and ${max}.`,
      );
    }
    return number;
  }

  private stringArray(value: unknown, label: string, max: number) {
    if (value == null) return [];
    if (
      !Array.isArray(value) ||
      value.length > max ||
      value.some((item) => typeof item !== "string")
    ) {
      throw this.validation(`SuiteCRM Cloud ${label} is invalid.`);
    }
    return value.map((item) => item.trim()).filter(Boolean);
  }

  private scalar(value: unknown) {
    return (
      value == null || ["string", "number", "boolean"].includes(typeof value)
    );
  }

  private required(value: unknown, label: string, max: number) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > max
    ) {
      throw this.validation(`SuiteCRM Cloud ${label} is required.`);
    }
    return value.trim();
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private assertShape(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 10)
      throw this.validation("SuiteCRM Cloud request is too deeply nested.");
    if (Array.isArray(value)) {
      if (value.length > 1_000)
        throw this.validation("SuiteCRM Cloud request array is too large.");
      value.forEach((item) => this.assertShape(item, depth + 1));
    } else if (typeof value === "object") {
      const entries = Object.entries(value as JsonObject);
      if (entries.length > 1_000)
        throw this.validation("SuiteCRM Cloud request object is too large.");
      entries.forEach(([, item]) => this.assertShape(item, depth + 1));
    } else if (typeof value === "string" && value.length > 100_000) {
      throw this.validation("SuiteCRM Cloud request string is too large.");
    }
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12)
      throw this.validation("SuiteCRM Cloud request is too deeply nested.");
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectSecrets(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(?:access.?token|api.?key|authorization|client.?(?:id|secret)|credential|password|refresh.?token)/i.test(
          key,
        )
      ) {
        throw new SuiteCrmCloudApiError(
          "policy_blocked",
          "SuiteCRM Cloud credential-bearing input is not allowed.",
          403,
        );
      }
      this.rejectSecrets(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[TRUNCATED]";
    if (Array.isArray(value))
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") {
      return typeof value === "string" && value.length > 100_000
        ? `${value.slice(0, 100_000)}[TRUNCATED]`
        : value;
    }
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(
      0,
      1_000,
    )) {
      result[key] =
        /(?:access.?token|api.?key|authorization|client.?(?:id|secret)|credential|password|refresh.?token)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(item, depth + 1);
    }
    return result;
  }

  private message(value: unknown) {
    const object = this.object(value);
    const errors = Array.isArray(object?.errors) ? object.errors : [];
    const first = this.object(errors[0]);
    const detail = typeof first?.detail === "string" ? first.detail : null;
    const title = typeof first?.title === "string" ? first.title : null;
    return (detail ?? title)?.slice(0, 1_000) ?? null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new SuiteCrmCloudApiError("provider_validation_error", message, 400);
  }
}
