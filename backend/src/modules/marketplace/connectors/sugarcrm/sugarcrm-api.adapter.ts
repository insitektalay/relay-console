import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PUT" | "DELETE";

export type SugarCrmCredentials = {
  host: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;
const MODULES = new Set([
  "Accounts",
  "Calls",
  "Campaigns",
  "Cases",
  "Contacts",
  "Contracts",
  "Documents",
  "Leads",
  "Meetings",
  "Notes",
  "Opportunities",
  "Products",
  "Prospects",
  "Quotes",
  "RevenueLineItems",
  "Tasks",
]);
const FILTER_OPERATORS = new Set([
  "$equals",
  "$not_equals",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$contains",
  "$starts",
]);
const READ_OPERATIONS = new Set(["list", "retrieve"]);
const MANAGE_OPERATIONS = new Set(["create", "update", "delete"]);

export class SugarCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class SugarCrmApiAdapter {
  async health(credentials: SugarCrmCredentials) {
    await this.apiRequest(credentials, {
      method: "GET",
      path: "/Accounts",
      query: new URLSearchParams({ fields: "id", max_num: "1", offset: "0" }),
    });
    return {
      authenticated: true,
      apiVersion: "v11",
      tenant: this.origin(credentials.host),
    };
  }

  read(credentials: SugarCrmCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, READ_OPERATIONS);
    const module = this.module(input.module);
    if (operation === "list") {
      return this.apiRequest(credentials, {
        method: "GET",
        path: `/${module}`,
        query: this.collectionQuery(input),
      });
    }
    return this.apiRequest(credentials, {
      method: "GET",
      path: `/${module}/${this.id(input.recordId)}`,
      query: this.fieldQuery(input.fields),
    });
  }

  manage(credentials: SugarCrmCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, MANAGE_OPERATIONS);
    const module = this.module(input.module);
    if (operation === "create") {
      return this.apiRequest(credentials, {
        method: "POST",
        path: `/${module}`,
        json: this.attributes(input.attributes),
      });
    }
    const recordId = this.id(input.recordId);
    if (operation === "update") {
      return this.apiRequest(credentials, {
        method: "PUT",
        path: `/${module}/${recordId}`,
        json: this.attributes(input.attributes),
      });
    }
    return this.apiRequest(credentials, {
      method: "DELETE",
      path: `/${module}/${recordId}`,
    });
  }

  private async apiRequest(
    credentials: SugarCrmCredentials,
    input: {
      method: Method;
      path: string;
      query?: URLSearchParams;
      json?: JsonObject;
    },
  ) {
    if (
      !/^\/(?:Accounts|Calls|Campaigns|Cases|Contacts|Contracts|Documents|Leads|Meetings|Notes|Opportunities|Products|Prospects|Quotes|RevenueLineItems|Tasks)(?:\/[0-9a-f-]{36})?$/i.test(
        input.path,
      ) ||
      input.path.includes("..")
    ) {
      throw this.validation("SugarCRM API path is invalid.");
    }
    this.rejectSecrets(input.json);
    this.assertShape(input.json);
    const origin = this.origin(credentials.host);
    const token = await this.accessToken(credentials, origin);
    const url = new URL(`${origin}/rest/v11${input.path}`);
    input.query?.forEach((value, key) => url.searchParams.append(key, value));
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw this.validation("SugarCRM request exceeds 1 MB.");
    }
    return this.fetchJson(url, {
      method: input.method,
      headers: {
        Accept: "application/json",
        "OAuth-Token": token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  }

  private async accessToken(credentials: SugarCrmCredentials, origin: string) {
    const body = JSON.stringify({
      grant_type: "password",
      client_id: this.credential(credentials.clientId, "OAuth client ID"),
      client_secret: this.credential(
        credentials.clientSecret,
        "OAuth client secret",
      ),
      username: this.credential(credentials.username, "username"),
      password: this.credential(credentials.password, "password"),
      platform: "relay_console_api",
    });
    if (Buffer.byteLength(body) > 100_000) {
      throw new SugarCrmApiError(
        "credential_missing",
        "SugarCRM credentials are invalid.",
        401,
      );
    }
    const result = await this.fetchJson(
      new URL(`${origin}/rest/v11/oauth2/token`),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
      false,
    );
    const object = this.object(result);
    const token =
      typeof object?.access_token === "string" ? object.access_token : null;
    if (!token || token.length > 20_000) {
      throw new SugarCrmApiError(
        "token_refresh_failed",
        "SugarCRM did not return a usable OAuth access token.",
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
        throw this.validation("SugarCRM response exceeds 5 MB.");
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
        throw new SugarCrmApiError(
          this.code(response.status),
          this.message(safeData) ??
            `SugarCRM returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return redactResponse ? this.redact(data) : data;
    } catch (error) {
      if (error instanceof SugarCrmApiError) throw error;
      throw new SugarCrmApiError(
        "provider_unavailable",
        "SugarCRM could not be reached.",
        502,
      );
    }
  }

  private origin(value: unknown) {
    const host = this.required(value, "host", 253).toLowerCase();
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+sugarondemand\.com$/.test(
        host,
      )
    ) {
      throw new SugarCrmApiError(
        "policy_blocked",
        "SugarCRM host must be an exact official SugarCloud sugarondemand.com subdomain.",
        403,
      );
    }
    return `https://${host}`;
  }

  private collectionQuery(input: JsonObject) {
    const params = this.fieldQuery(input.fields);
    const maxNum =
      input.maxNum == null ? 100 : this.integer(input.maxNum, "maxNum", 1, 100);
    const offset =
      input.offset == null
        ? 0
        : this.integer(input.offset, "offset", 0, 10_000);
    params.set("max_num", String(maxNum));
    params.set("offset", String(offset));
    if (input.orderBy != null) {
      const field = this.field(input.orderBy, "orderBy");
      const direction =
        input.direction == null
          ? "ASC"
          : this.enumValue(input.direction, "direction", ["ASC", "DESC"]);
      params.set("order_by", `${field}:${direction}`);
    }
    const filters = this.object(input.filters);
    if (filters) {
      if (Object.keys(filters).length > 25) {
        throw this.validation("SugarCRM filters are too numerous.");
      }
      const sugarFilters: JsonObject[] = [];
      for (const [fieldName, conditionValue] of Object.entries(filters)) {
        const field = this.field(fieldName, "filter field");
        const condition = this.object(conditionValue);
        if (!condition || Object.keys(condition).length !== 1) {
          throw this.validation(
            "SugarCRM filter condition must contain one operator.",
          );
        }
        const [operator, value] = Object.entries(condition)[0];
        if (!FILTER_OPERATORS.has(operator)) {
          throw this.validation("SugarCRM filter operator is not supported.");
        }
        if (!this.scalar(value)) {
          throw this.validation("SugarCRM filter value must be scalar.");
        }
        sugarFilters.push({ [field]: { [operator]: value } });
      }
      params.set("filter", JSON.stringify(sugarFilters));
    }
    return params;
  }

  private fieldQuery(value: unknown) {
    const params = new URLSearchParams();
    const fields = this.stringArray(value, "fields", 50).map((field) =>
      this.field(field, "field"),
    );
    if (fields.length) params.set("fields", fields.join(","));
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
        "SugarCRM attributes must contain 1 to 200 fields.",
      );
    }
    for (const key of Object.keys(attributes))
      this.field(key, "attribute field");
    this.rejectSecrets(attributes);
    this.assertShape(attributes);
    return attributes;
  }

  private module(value: unknown) {
    const module = this.required(value, "module", 100);
    if (!MODULES.has(module)) {
      throw this.validation("SugarCRM module is outside the selected modules.");
    }
    return module;
  }

  private id(value: unknown) {
    const id = this.required(value, "recordId", 36);
    if (!UUID.test(id)) throw this.validation("SugarCRM recordId is invalid.");
    return id;
  }

  private field(value: unknown, label: string) {
    const field = this.required(value, label, 100);
    if (!FIELD.test(field))
      throw this.validation(`SugarCRM ${label} is invalid.`);
    return field;
  }

  private operation(value: unknown, allowed: Set<string>) {
    const operation = this.required(value, "operation", 50).toLowerCase();
    if (!allowed.has(operation)) {
      throw this.validation("SugarCRM operation is not supported.");
    }
    return operation;
  }

  private credential(value: unknown, label: string) {
    const text = this.required(value, label, 10_000);
    if (/[\r\n]/.test(text)) {
      throw new SugarCrmApiError(
        "credential_missing",
        `SugarCRM ${label} is invalid.`,
        401,
      );
    }
    return text;
  }

  private enumValue(value: unknown, label: string, values: string[]) {
    const text = this.required(value, label, 20);
    if (!values.includes(text)) {
      throw this.validation(`SugarCRM ${label} is invalid.`);
    }
    return text;
  }

  private integer(value: unknown, label: string, min: number, max: number) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw this.validation(
        `SugarCRM ${label} must be between ${min} and ${max}.`,
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
      throw this.validation(`SugarCRM ${label} is invalid.`);
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
      throw this.validation(`SugarCRM ${label} is required.`);
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
      throw this.validation("SugarCRM request is too deeply nested.");
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw this.validation("SugarCRM request array is too large.");
      }
      value.forEach((item) => this.assertShape(item, depth + 1));
    } else if (typeof value === "object") {
      const entries = Object.entries(value as JsonObject);
      if (entries.length > 1_000) {
        throw this.validation("SugarCRM request object is too large.");
      }
      entries.forEach(([, item]) => this.assertShape(item, depth + 1));
    } else if (typeof value === "string" && value.length > 100_000) {
      throw this.validation("SugarCRM request string is too large.");
    }
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12)
      throw this.validation("SugarCRM request is too deeply nested.");
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectSecrets(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(?:access.?token|download.?token|api.?key|authorization|client.?(?:id|secret)|credential|password|refresh.?token|username)/i.test(
          key,
        )
      ) {
        throw new SugarCrmApiError(
          "policy_blocked",
          "SugarCRM credential-bearing input is not allowed.",
          403,
        );
      }
      this.rejectSecrets(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[TRUNCATED]";
    if (Array.isArray(value)) {
      return value.slice(0, 1_000).map((item) => this.redact(item, depth + 1));
    }
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
        /(?:access.?token|download.?token|api.?key|authorization|client.?(?:id|secret)|credential|password|refresh.?token)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(item, depth + 1);
    }
    return result;
  }

  private message(value: unknown) {
    const object = this.object(value);
    const errorMessage =
      typeof object?.error_message === "string" ? object.error_message : null;
    const error = typeof object?.error === "string" ? object.error : null;
    return (errorMessage ?? error)?.slice(0, 1_000) ?? null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new SugarCrmApiError("provider_validation_error", message, 400);
  }
}
