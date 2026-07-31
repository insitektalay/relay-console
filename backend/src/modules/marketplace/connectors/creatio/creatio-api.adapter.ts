import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type CreatioCredentials = {
  host: string;
  username: string;
  password: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;
const ENTITIES = new Set([
  "Account",
  "Activity",
  "Campaign",
  "Case",
  "Contact",
  "Contract",
  "Document",
  "Invoice",
  "Lead",
  "Opportunity",
  "Order",
  "Product",
]);
const FILTER_OPERATORS = new Set([
  "eq",
  "ne",
  "gt",
  "ge",
  "lt",
  "le",
  "contains",
  "startswith",
]);
const READ_OPERATIONS = new Set(["list", "retrieve"]);
const MANAGE_OPERATIONS = new Set(["create", "update", "delete"]);

type CreatioSession = { cookie: string; csrf: string };

export class CreatioApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CreatioApiAdapter {
  async health(credentials: CreatioCredentials) {
    await this.apiRequest(credentials, {
      method: "GET",
      path: "/0/odata/Contact",
      query: new URLSearchParams({ $select: "Id", $top: "1", $skip: "0" }),
    });
    return {
      authenticated: true,
      protocol: "OData 4",
      tenant: this.origin(credentials.host),
    };
  }

  read(credentials: CreatioCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, READ_OPERATIONS);
    const entity = this.entity(input.entity);
    if (operation === "list") {
      return this.apiRequest(credentials, {
        method: "GET",
        path: `/0/odata/${entity}`,
        query: this.collectionQuery(input),
      });
    }
    return this.apiRequest(credentials, {
      method: "GET",
      path: `/0/odata/${entity}(${this.id(input.recordId)})`,
      query: this.fieldQuery(input.fields),
    });
  }

  manage(credentials: CreatioCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, MANAGE_OPERATIONS);
    const entity = this.entity(input.entity);
    if (operation === "create") {
      return this.apiRequest(credentials, {
        method: "POST",
        path: `/0/odata/${entity}`,
        json: this.attributes(input.attributes),
      });
    }
    const recordId = this.id(input.recordId);
    if (operation === "update") {
      return this.apiRequest(credentials, {
        method: "PATCH",
        path: `/0/odata/${entity}(${recordId})`,
        json: this.attributes(input.attributes),
      });
    }
    return this.apiRequest(credentials, {
      method: "DELETE",
      path: `/0/odata/${entity}(${recordId})`,
    });
  }

  private async apiRequest(
    credentials: CreatioCredentials,
    input: {
      method: Method;
      path: string;
      query?: URLSearchParams;
      json?: JsonObject;
    },
  ) {
    if (
      !/^\/0\/odata\/(?:Account|Activity|Campaign|Case|Contact|Contract|Document|Invoice|Lead|Opportunity|Order|Product)(?:\([0-9a-f-]{36}\))?$/i.test(
        input.path,
      ) ||
      input.path.includes("..")
    ) {
      throw this.validation("Creatio OData path is invalid.");
    }
    this.rejectSecrets(input.json);
    this.assertShape(input.json);
    const origin = this.origin(credentials.host);
    const session = await this.login(credentials, origin);
    const url = new URL(`${origin}${input.path}`);
    input.query?.forEach((value, key) => url.searchParams.append(key, value));
    const body = input.json ? JSON.stringify(input.json) : undefined;
    if (body && Buffer.byteLength(body) > 1_000_000) {
      throw this.validation("Creatio request exceeds 1 MB.");
    }
    return this.fetchJson(url, {
      method: input.method,
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json; charset=utf-8; IEEE754Compatible=true",
        ForceUseSession: "true",
        BPMCSRF: session.csrf,
        Cookie: session.cookie,
      },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  }

  private async login(
    credentials: CreatioCredentials,
    origin: string,
  ): Promise<CreatioSession> {
    const body = JSON.stringify({
      UserName: this.credential(credentials.username, "username"),
      UserPassword: this.credential(credentials.password, "password"),
    });
    try {
      const response = await safeConnectorFetch(
        new URL(`${origin}/ServiceModel/AuthService.svc/Login`),
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
            ForceUseSession: "true",
          },
          body,
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        },
      );
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 1_000_000) {
        throw new CreatioApiError(
          "token_refresh_failed",
          "Creatio authentication response is invalid.",
          401,
        );
      }
      let data: unknown;
      try {
        data = raw.byteLength ? JSON.parse(raw.toString("utf8")) : null;
      } catch {
        data = null;
      }
      const object = this.object(data);
      if (!response.ok || (object?.Code !== 0 && object?.Code !== "0")) {
        throw new CreatioApiError(
          response.status === 429
            ? "provider_rate_limited"
            : "token_refresh_failed",
          "Creatio rejected the dedicated integration-user credentials.",
          response.ok ? 401 : response.status,
        );
      }
      const cookieHeader = response.headers.get("set-cookie") ?? "";
      if (!cookieHeader || cookieHeader.length > 100_000) {
        throw new CreatioApiError(
          "token_refresh_failed",
          "Creatio did not return a usable authenticated session.",
          401,
        );
      }
      const names = ["BPMLOADER", ".ASPXAUTH", "BPMCSRF", "UserName"];
      const cookies = names
        .map((name) => {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const match = cookieHeader.match(
            new RegExp(`(?:^|[,;]\\s*)${escaped}=([^;,]*)`, "i"),
          );
          const value = match?.[1]?.trim() ?? "";
          return value && value.length <= 20_000 && !/[\r\n]/.test(value)
            ? { name, value }
            : null;
        })
        .filter(
          (item): item is { name: string; value: string } => item != null,
        );
      const csrf = cookies.find((item) => item.name === "BPMCSRF")?.value;
      const auth = cookies.find((item) => item.name === ".ASPXAUTH")?.value;
      if (!csrf || !auth) {
        throw new CreatioApiError(
          "token_refresh_failed",
          "Creatio did not return the required authenticated session cookies.",
          401,
        );
      }
      return {
        cookie: cookies.map((item) => `${item.name}=${item.value}`).join("; "),
        csrf,
      };
    } catch (error) {
      if (error instanceof CreatioApiError) throw error;
      throw new CreatioApiError(
        "provider_unavailable",
        "Creatio authentication could not be reached.",
        502,
      );
    }
  }

  private async fetchJson(url: URL, init: RequestInit) {
    try {
      const response = await safeConnectorFetch(url, init);
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000) {
        throw this.validation("Creatio response exceeds 5 MB.");
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
        throw new CreatioApiError(
          this.code(response.status),
          this.message(safeData) ?? `Creatio returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return this.redact(data);
    } catch (error) {
      if (error instanceof CreatioApiError) throw error;
      throw new CreatioApiError(
        "provider_unavailable",
        "Creatio could not be reached.",
        502,
      );
    }
  }

  private origin(value: unknown) {
    const host = this.required(value, "host", 253).toLowerCase();
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+creatio\.com$/.test(host)
    ) {
      throw new CreatioApiError(
        "policy_blocked",
        "Creatio host must be an exact official Creatio Cloud creatio.com subdomain.",
        403,
      );
    }
    return `https://${host}`;
  }

  private collectionQuery(input: JsonObject) {
    const params = this.fieldQuery(input.fields);
    const top =
      input.top == null ? 100 : this.integer(input.top, "top", 1, 100);
    const skip =
      input.skip == null ? 0 : this.integer(input.skip, "skip", 0, 10_000);
    params.set("$top", String(top));
    params.set("$skip", String(skip));
    if (input.orderBy != null) {
      const field = this.field(input.orderBy, "orderBy");
      const direction =
        input.direction == null
          ? "asc"
          : this.enumValue(input.direction, "direction", ["asc", "desc"]);
      params.set("$orderby", `${field} ${direction}`);
    }
    const filters = this.object(input.filters);
    if (filters) {
      if (Object.keys(filters).length > 25) {
        throw this.validation("Creatio filters are too numerous.");
      }
      const expressions: string[] = [];
      for (const [fieldName, conditionValue] of Object.entries(filters)) {
        const field = this.field(fieldName, "filter field");
        const condition = this.object(conditionValue);
        if (!condition || Object.keys(condition).length !== 1) {
          throw this.validation(
            "Creatio filter condition must contain one operator.",
          );
        }
        const [operator, value] = Object.entries(condition)[0];
        if (!FILTER_OPERATORS.has(operator)) {
          throw this.validation("Creatio filter operator is not supported.");
        }
        const scalar = this.odataScalar(value);
        if (
          (operator === "contains" || operator === "startswith") &&
          typeof value !== "string"
        ) {
          throw this.validation(
            `Creatio ${operator} filter requires a string.`,
          );
        }
        if (value == null && operator !== "eq" && operator !== "ne") {
          throw this.validation("Creatio null filters support only eq or ne.");
        }
        expressions.push(
          operator === "contains" || operator === "startswith"
            ? `${operator}(${field},${scalar})`
            : `${field} ${operator} ${scalar}`,
        );
      }
      if (expressions.length) params.set("$filter", expressions.join(" and "));
    }
    return params;
  }

  private fieldQuery(value: unknown) {
    const params = new URLSearchParams();
    const fields = this.stringArray(value, "fields", 50).map((field) =>
      this.field(field, "field"),
    );
    if (fields.length) params.set("$select", fields.join(","));
    return params;
  }

  private attributes(value: unknown) {
    const attributes = this.object(value);
    if (
      !attributes ||
      !Object.keys(attributes).length ||
      Object.keys(attributes).length > 200
    ) {
      throw this.validation("Creatio attributes must contain 1 to 200 fields.");
    }
    for (const key of Object.keys(attributes))
      this.field(key, "attribute field");
    this.rejectSecrets(attributes);
    this.assertShape(attributes);
    return attributes;
  }

  private entity(value: unknown) {
    const entity = this.required(value, "entity", 100);
    if (!ENTITIES.has(entity)) {
      throw this.validation("Creatio entity is outside the selected entities.");
    }
    return entity;
  }

  private id(value: unknown) {
    const id = this.required(value, "recordId", 36);
    if (!UUID.test(id)) throw this.validation("Creatio recordId is invalid.");
    return id;
  }

  private field(value: unknown, label: string) {
    const field = this.required(value, label, 100);
    if (!FIELD.test(field))
      throw this.validation(`Creatio ${label} is invalid.`);
    return field;
  }

  private operation(value: unknown, allowed: Set<string>) {
    const operation = this.required(value, "operation", 50).toLowerCase();
    if (!allowed.has(operation)) {
      throw this.validation("Creatio operation is not supported.");
    }
    return operation;
  }

  private credential(value: unknown, label: string) {
    const text = this.required(value, label, 10_000);
    if (/[\r\n]/.test(text)) {
      throw new CreatioApiError(
        "credential_missing",
        `Creatio ${label} is invalid.`,
        401,
      );
    }
    return text;
  }

  private odataScalar(value: unknown) {
    if (value == null) return "null";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    if (typeof value === "string" && value.length <= 2_000) {
      return `'${value.replace(/'/g, "''")}'`;
    }
    throw this.validation("Creatio filter value must be a bounded scalar.");
  }

  private enumValue(value: unknown, label: string, values: string[]) {
    const text = this.required(value, label, 20).toLowerCase();
    if (!values.includes(text)) {
      throw this.validation(`Creatio ${label} is invalid.`);
    }
    return text;
  }

  private integer(value: unknown, label: string, min: number, max: number) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw this.validation(
        `Creatio ${label} must be between ${min} and ${max}.`,
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
      throw this.validation(`Creatio ${label} is invalid.`);
    }
    return value.map((item) => item.trim()).filter(Boolean);
  }

  private required(value: unknown, label: string, max: number) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > max
    ) {
      throw this.validation(`Creatio ${label} is required.`);
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
      throw this.validation("Creatio request is too deeply nested.");
    if (Array.isArray(value)) {
      if (value.length > 1_000) {
        throw this.validation("Creatio request array is too large.");
      }
      value.forEach((item) => this.assertShape(item, depth + 1));
    } else if (typeof value === "object") {
      const entries = Object.entries(value as JsonObject);
      if (entries.length > 1_000) {
        throw this.validation("Creatio request object is too large.");
      }
      entries.forEach(([, item]) => this.assertShape(item, depth + 1));
    } else if (typeof value === "string" && value.length > 100_000) {
      throw this.validation("Creatio request string is too large.");
    }
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12)
      throw this.validation("Creatio request is too deeply nested.");
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectSecrets(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(?:access.?token|api.?key|authorization|client.?(?:id|secret)|cookie|credential|password|refresh.?token|username|bpmcsrf|aspxauth)/i.test(
          key,
        )
      ) {
        throw new CreatioApiError(
          "policy_blocked",
          "Creatio credential-bearing input is not allowed.",
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
        /(?:access.?token|api.?key|authorization|client.?(?:id|secret)|cookie|credential|password|refresh.?token|username|bpmcsrf|aspxauth)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(item, depth + 1);
    }
    return result;
  }

  private message(value: unknown) {
    const object = this.object(value);
    const error = this.object(object?.error);
    const nested = error?.message;
    const message =
      typeof nested === "string"
        ? nested
        : typeof this.object(nested)?.value === "string"
          ? (this.object(nested)?.value as string)
          : null;
    return message?.slice(0, 1_000) ?? null;
  }

  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new CreatioApiError("provider_validation_error", message, 400);
  }
}
