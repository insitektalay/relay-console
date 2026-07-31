import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Method = "GET" | "POST";

export type VtigerCrmCredentials = {
  instance: string;
  cluster: string;
  username: string;
  accessKey: string;
};

const RECORD_ID = /^\d{1,10}x\d{1,20}$/;
const FIELD = /^[A-Za-z][A-Za-z0-9_]{0,99}$/;
const MODULES = new Set([
  "Accounts",
  "Calendar",
  "Campaigns",
  "Contacts",
  "Documents",
  "Events",
  "HelpDesk",
  "Invoice",
  "Leads",
  "Potentials",
  "Products",
  "Project",
  "ProjectTask",
  "PurchaseOrder",
  "Quotes",
  "SalesOrder",
  "Services",
  "Tasks",
  "Vendors",
]);
const READ_OPERATIONS = new Set([
  "me",
  "list_types",
  "describe",
  "retrieve",
  "query",
  "sync",
  "related_types",
  "retrieve_related",
  "query_related",
  "picklist_dependency",
  "tags_retrieve",
  "account_hierarchy",
  "lookup",
]);
const MANAGE_OPERATIONS = new Set([
  "create",
  "update",
  "revise",
  "delete",
  "add_related",
  "delete_related",
  "reopen",
  "tags_add",
  "tags_delete",
]);

export class VtigerCrmApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class VtigerCrmApiAdapter {
  async health(credentials: VtigerCrmCredentials) {
    const result = await this.request(credentials, {
      method: "GET",
      operation: "me",
    });
    const object = this.object(result);
    const user = this.object(object?.result);
    const id = typeof user?.id === "string" ? user.id : null;
    if (!id || !RECORD_ID.test(id)) {
      throw new VtigerCrmApiError(
        "policy_blocked",
        "Vtiger did not return a valid connected-user record.",
      );
    }
    return {
      userVerified: true,
      userId: id,
      apiVersion: "v1",
      currentUser: user,
    };
  }

  read(credentials: VtigerCrmCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, READ_OPERATIONS);
    const params: JsonObject = {};
    switch (operation) {
      case "me":
        break;
      case "list_types": {
        const fieldTypes = this.stringArray(
          input.fieldTypes,
          "fieldTypes",
          25,
        ).map((value) => this.field(value, "fieldTypes"));
        if (fieldTypes.length)
          params.fieldTypeList = JSON.stringify(fieldTypes);
        break;
      }
      case "describe":
      case "related_types":
        params.elementType = this.module(input.module);
        break;
      case "retrieve":
      case "tags_retrieve":
      case "account_hierarchy":
        params.id = this.recordId(input.recordId);
        break;
      case "query":
        params.query = this.query(input);
        break;
      case "sync":
        params.modifiedTime = this.integer(
          input.modifiedTime,
          "modifiedTime",
          0,
          4_102_444_800,
        );
        params.elementType = this.module(input.module);
        params.syncType = this.enumValue(input.syncType, "syncType", [
          "user",
          "userandgroup",
          "application",
        ]);
        break;
      case "retrieve_related":
        params.id = this.recordId(input.recordId);
        params.relatedLabel = this.module(input.relatedLabel, "relatedLabel");
        params.relatedType = this.module(input.relatedType, "relatedType");
        break;
      case "query_related":
        params.id = this.recordId(input.recordId);
        params.relatedLabel = this.module(input.relatedLabel, "relatedLabel");
        params.query = this.query(input);
        break;
      case "picklist_dependency":
        params.module = this.module(input.module);
        params.sourcefield = this.field(input.sourceField, "sourceField");
        params.targetfield = this.field(input.targetField, "targetField");
        break;
      case "lookup":
        params.type = this.enumValue(input.lookupType, "lookupType", [
          "phone",
          "email",
        ]);
        params.value = this.required(input.value, "value", 500);
        params.searchIn = JSON.stringify(this.searchIn(input.searchIn));
        break;
    }
    return this.request(credentials, { method: "GET", operation, params });
  }

  manage(credentials: VtigerCrmCredentials, input: JsonObject) {
    const operation = this.operation(input.operation, MANAGE_OPERATIONS);
    const params: JsonObject = {};
    switch (operation) {
      case "create":
        params.elementType = this.module(input.module);
        params.element = JSON.stringify(this.element(input.element, false));
        break;
      case "update":
      case "revise":
        params.element = JSON.stringify(this.element(input.element, true));
        break;
      case "delete":
      case "reopen":
        params.id = this.recordId(input.recordId);
        break;
      case "add_related":
        params.sourceRecordId = this.recordId(input.recordId);
        params.relatedRecordId = this.recordId(
          input.relatedRecordId,
          "relatedRecordId",
        );
        params.relationIdLabel = this.module(
          input.relatedLabel,
          "relatedLabel",
        );
        break;
      case "delete_related":
        params.sourceRecordId = this.recordId(input.recordId);
        params.relatedRecordId = this.recordId(
          input.relatedRecordId,
          "relatedRecordId",
        );
        break;
      case "tags_add":
        params.id = this.recordId(input.recordId);
        params.tags = JSON.stringify(this.tags(input.tags));
        break;
      case "tags_delete":
        params.id = this.recordId(input.recordId);
        params.tags = JSON.stringify(this.tags(input.tags));
        if (input.deleteAll != null && typeof input.deleteAll !== "boolean") {
          throw this.validation("Vtiger deleteAll must be a boolean.");
        }
        params.delete_all = input.deleteAll === true;
        break;
    }
    return this.request(credentials, {
      method: "POST",
      operation: operation === "tags_delete" ? "tag_delete" : operation,
      params,
    });
  }

  private async request(
    credentials: VtigerCrmCredentials,
    input: { method: Method; operation: string; params?: JsonObject },
  ) {
    const origin = this.origin(credentials);
    const username = this.username(credentials.username);
    const accessKey = credentials.accessKey?.trim();
    if (!accessKey || accessKey.length > 10_000) {
      throw new VtigerCrmApiError(
        "credential_missing",
        "Vtiger access key is required.",
        401,
      );
    }
    const permitted =
      READ_OPERATIONS.has(input.operation) ||
      MANAGE_OPERATIONS.has(input.operation) ||
      input.operation === "tag_delete";
    if (!permitted) throw this.validation("Vtiger API operation is invalid.");
    this.rejectSecrets(input.params);

    const url = new URL(
      `${origin}/restapi/v1/vtiger/default/${input.operation}`,
    );
    const encoded = new URLSearchParams();
    this.appendParams(encoded, input.params);
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${username}:${accessKey}`, "utf8").toString("base64")}`,
    };
    let body: string | undefined;
    if (input.method === "GET") {
      encoded.forEach((value, key) => url.searchParams.append(key, value));
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = encoded.toString();
      if (Buffer.byteLength(body) > 1_000_000) {
        throw this.validation("Vtiger request exceeds 1 MB.");
      }
    }

    try {
      const response = await safeConnectorFetch(url, {
        method: input.method,
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > 5_000_000) {
        throw this.validation("Vtiger response exceeds 5 MB.");
      }
      const text = raw.toString("utf8");
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 1_000_000);
      }
      data = this.redact(data);
      const object = this.object(data);
      if (!response.ok || object?.success === false) {
        const error = this.object(object?.error);
        const providerCode =
          typeof error?.code === "string" ? error.code : null;
        throw new VtigerCrmApiError(
          this.code(response.status, providerCode),
          typeof error?.message === "string"
            ? error.message.slice(0, 1_000)
            : `Vtiger returned HTTP ${response.status}.`,
          response.status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof VtigerCrmApiError) throw error;
      throw new VtigerCrmApiError(
        "provider_unavailable",
        "Vtiger CRM could not be reached.",
        502,
      );
    }
  }

  private origin(credentials: VtigerCrmCredentials) {
    const instance = this.required(
      credentials.instance,
      "instance",
      63,
    ).toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(instance)) {
      throw new VtigerCrmApiError(
        "credential_missing",
        "Vtiger instance must be the subdomain from the CRM URL.",
        401,
      );
    }
    const cluster = this.enumValue(
      credentials.cluster?.toLowerCase(),
      "cluster",
      ["od1", "od2", "od3"],
    );
    return `https://${instance}.${cluster}.vtiger.com`;
  }

  private query(input: JsonObject) {
    const module = this.module(input.module);
    const fields = this.stringArray(input.fields, "fields", 50).map((value) =>
      this.field(value, "fields"),
    );
    const filter = typeof input.filter === "string" ? input.filter.trim() : "";
    if (filter.length > 2_000 || /[;\0]|--|\/\*|\*\//.test(filter)) {
      throw this.validation("Vtiger query filter is invalid.");
    }
    if (
      /\b(?:select|from|join|union|insert|update|delete|drop)\b/i.test(filter)
    ) {
      throw this.validation("Vtiger query filter contains a blocked clause.");
    }
    const orderBy = this.stringArray(input.orderBy, "orderBy", 10).map(
      (value) => this.field(value, "orderBy"),
    );
    const direction =
      input.direction == null
        ? "ASC"
        : this.enumValue(input.direction, "direction", ["ASC", "DESC"]);
    const offset =
      input.offset == null
        ? 0
        : this.integer(input.offset, "offset", 0, 10_000);
    const limit =
      input.limit == null ? 100 : this.integer(input.limit, "limit", 1, 100);
    let query = `SELECT ${fields.length ? fields.join(",") : "*"} FROM ${module}`;
    if (filter) query += ` WHERE ${filter}`;
    if (orderBy.length) query += ` ORDER BY ${orderBy.join(",")} ${direction}`;
    query += ` LIMIT ${offset}, ${limit};`;
    return query;
  }

  private searchIn(value: unknown) {
    const object = this.object(value);
    if (
      !object ||
      !Object.keys(object).length ||
      Object.keys(object).length > 10
    ) {
      throw this.validation(
        "Vtiger lookup searchIn must contain 1 to 10 modules.",
      );
    }
    const result: Record<string, string[]> = {};
    for (const [module, fields] of Object.entries(object)) {
      const validModule = this.module(module);
      result[validModule] = this.stringArray(
        fields,
        `searchIn.${module}`,
        25,
      ).map((field) => this.field(field, `searchIn.${module}`));
    }
    return result;
  }

  private element(value: unknown, idRequired: boolean) {
    const element = this.object(value);
    if (
      !element ||
      !Object.keys(element).length ||
      Object.keys(element).length > 200
    ) {
      throw this.validation("Vtiger element must contain 1 to 200 fields.");
    }
    for (const key of Object.keys(element)) this.field(key, "element field");
    if (idRequired) this.recordId(element.id, "element.id");
    else if (element.id != null)
      throw this.validation("Vtiger create element cannot include id.");
    this.rejectSecrets(element);
    this.assertShape(element);
    return element;
  }

  private tags(value: unknown) {
    const tags = this.stringArray(value, "tags", 25);
    if (!tags.length || tags.some((tag) => tag.length > 100)) {
      throw this.validation("Vtiger tags must contain 1 to 25 bounded names.");
    }
    return tags;
  }

  private module(value: unknown, label = "module") {
    const module = this.required(value, label, 100);
    if (!MODULES.has(module)) {
      throw this.validation(
        `Vtiger ${label} is outside the selected CRM modules.`,
      );
    }
    return module;
  }

  private field(value: unknown, label: string) {
    const field = this.required(value, label, 100);
    if (!FIELD.test(field))
      throw this.validation(`Vtiger ${label} is invalid.`);
    return field;
  }

  private recordId(value: unknown, label = "recordId") {
    const id = this.required(value, label, 40);
    if (!RECORD_ID.test(id))
      throw this.validation(`Vtiger ${label} is invalid.`);
    return id;
  }

  private username(value: unknown) {
    const username = this.required(value, "username", 320).toLowerCase();
    if (!/^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/.test(username)) {
      throw new VtigerCrmApiError(
        "credential_missing",
        "Vtiger username must be the connected user's login email.",
        401,
      );
    }
    return username;
  }

  private operation(value: unknown, allowed: Set<string>) {
    const operation = this.required(value, "operation", 50).toLowerCase();
    if (!allowed.has(operation))
      throw this.validation("Vtiger operation is not supported.");
    return operation;
  }

  private enumValue(value: unknown, label: string, values: string[]) {
    const text = this.required(value, label, 100);
    if (!values.includes(text))
      throw this.validation(`Vtiger ${label} is invalid.`);
    return text;
  }

  private integer(value: unknown, label: string, min: number, max: number) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < min || number > max) {
      throw this.validation(
        `Vtiger ${label} must be between ${min} and ${max}.`,
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
      throw this.validation(`Vtiger ${label} is invalid.`);
    }
    return value.map((item) => item.trim()).filter(Boolean);
  }

  private appendParams(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 25)
      throw this.validation("Vtiger request has too many parameters.");
    for (const [key, item] of Object.entries(value)) {
      if (!FIELD.test(key))
        throw this.validation("Vtiger parameter name is invalid.");
      if (!["string", "number", "boolean"].includes(typeof item)) {
        throw this.validation("Vtiger parameter value is invalid.");
      }
      const text = String(item);
      if (text.length > 100_000)
        throw this.validation("Vtiger parameter is too large.");
      params.append(key, text);
    }
  }

  private required(value: unknown, label: string, max: number) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > max
    ) {
      throw this.validation(`Vtiger ${label} is required.`);
    }
    return value.trim();
  }

  private object(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : undefined;
  }

  private assertShape(value: unknown, depth = 0) {
    if (depth > 10)
      throw this.validation("Vtiger request is too deeply nested.");
    if (Array.isArray(value)) {
      if (value.length > 1_000)
        throw this.validation("Vtiger request array is too large.");
      value.forEach((item) => this.assertShape(item, depth + 1));
    } else if (value && typeof value === "object") {
      const entries = Object.entries(value as JsonObject);
      if (entries.length > 1_000)
        throw this.validation("Vtiger request object is too large.");
      entries.forEach(([, item]) => this.assertShape(item, depth + 1));
    } else if (typeof value === "string" && value.length > 100_000) {
      throw this.validation("Vtiger request string is too large.");
    }
  }

  private rejectSecrets(value: unknown, depth = 0) {
    if (value == null) return;
    if (depth > 12)
      throw this.validation("Vtiger request is too deeply nested.");
    if (Array.isArray(value)) {
      value.forEach((item) => this.rejectSecrets(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (
        /(?:access.?key|api.?key|authorization|credential|password|secret|token|session)/i.test(
          key,
        )
      ) {
        throw new VtigerCrmApiError(
          "policy_blocked",
          "Vtiger credential-bearing input is not allowed.",
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
        /(?:access.?key|authorization|credential|password|secret|token|session)/i.test(
          key,
        )
          ? "[REDACTED]"
          : this.redact(item, depth + 1);
    }
    return result;
  }

  private code(
    status: number,
    providerCode: string | null,
  ): MarketplaceConnectorSafeErrorCode {
    const code = providerCode?.toUpperCase() ?? "";
    if (status === 401 || /AUTH|ACCESS_DENIED/.test(code))
      return "token_expired";
    if (status === 403 || /PERMISSION|NOT_PERMITTED/.test(code))
      return "insufficient_scope";
    if (status === 429 || /LIMIT|RATE|THROTTL/.test(code))
      return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new VtigerCrmApiError("provider_validation_error", message, 400);
  }
}
