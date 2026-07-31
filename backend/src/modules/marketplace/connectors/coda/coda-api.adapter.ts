import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
export type CodaCredentials = { apiToken: string };

export class CodaApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class CodaApiAdapter {
  private readonly origin = "https://coda.io/apis/v1";

  async health(credentials: CodaCredentials) {
    const value = await this.request(credentials, "GET", "/whoami");
    return {
      name: this.text(value.name),
      loginId: this.text(value.loginId),
      scoped: value.scoped === true,
      tokenName: this.text(value.tokenName),
      workspace: this.safe(value.workspace, 8_000),
      providerRequestCount: 1,
    };
  }
  async listDocs(credentials: CodaCredentials, input: JsonObject) {
    const max = this.limit(input.maxResults, 20, 25);
    const value = await this.request(credentials, "GET", `/docs?limit=${max}`);
    return this.collection(value, max, "docs");
  }
  async getDoc(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId");
    return {
      docId,
      doc: this.safe(
        await this.request(credentials, "GET", `/docs/${this.path(docId)}`),
        40_000,
      ),
      providerRequestCount: 1,
    };
  }
  async listPages(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId"),
      max = this.limit(input.maxResults, 25, 50);
    const value = await this.request(
      credentials,
      "GET",
      `/docs/${this.path(docId)}/pages?limit=${max}`,
    );
    return { docId, ...this.collection(value, max, "pages") };
  }
  async listTables(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId"),
      max = this.limit(input.maxResults, 25, 50);
    const value = await this.request(
      credentials,
      "GET",
      `/docs/${this.path(docId)}/tables?limit=${max}`,
    );
    return { docId, ...this.collection(value, max, "tables") };
  }
  async listRows(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId"),
      tableId = this.id(input.tableId, "tableId"),
      max = this.limit(input.maxResults, 25, 50);
    const value = await this.request(
      credentials,
      "GET",
      `/docs/${this.path(docId)}/tables/${this.path(tableId)}/rows?limit=${max}&valueFormat=simpleWithArrays`,
    );
    return { docId, tableId, ...this.collection(value, max, "rows") };
  }
  async getRow(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId"),
      tableId = this.id(input.tableId, "tableId"),
      rowId = this.id(input.rowId, "rowId");
    const row = await this.request(
      credentials,
      "GET",
      `/docs/${this.path(docId)}/tables/${this.path(tableId)}/rows/${this.path(rowId)}?valueFormat=simpleWithArrays`,
    );
    return {
      docId,
      tableId,
      rowId,
      row: this.safe(row, 60_000),
      providerRequestCount: 1,
    };
  }
  async getMutationStatus(credentials: CodaCredentials, input: JsonObject) {
    const requestId = this.id(input.requestId, "requestId");
    const value = await this.request(
      credentials,
      "GET",
      `/mutationStatus/${this.path(requestId)}`,
    );
    return {
      requestId,
      completed: value.completed === true,
      warning: this.text(value.warning),
      providerRequestCount: 1,
    };
  }
  draftRowChange(input: JsonObject) {
    const operation =
      input.operation === "insert" || input.operation === "update"
        ? input.operation
        : this.fail("operation must be insert or update");
    const docId = this.id(input.docId, "docId"),
      tableId = this.id(input.tableId, "tableId"),
      rowId = operation === "update" ? this.id(input.rowId, "rowId") : null,
      cells = this.parseCells(input.cells);
    const change = { operation, docId, tableId, rowId, cells };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }
  async insertRow(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId"),
      tableId = this.id(input.tableId, "tableId"),
      cells = this.parseCells(input.cells),
      idempotencyKey = this.key(input.idempotencyKey);
    const query = input.disableParsing === true ? "?disableParsing=true" : "";
    const value = await this.request(
      credentials,
      "POST",
      `/docs/${this.path(docId)}/tables/${this.path(tableId)}/rows${query}`,
      { rows: [{ cells }] },
    );
    return {
      docId,
      tableId,
      requestId: this.text(value.requestId),
      addedRowIds: this.array(value.addedRowIds).slice(0, 1).map(String),
      idempotencyKey,
      queued: true,
      providerRequestCount: 1,
    };
  }
  async updateRow(credentials: CodaCredentials, input: JsonObject) {
    const docId = this.id(input.docId, "docId"),
      tableId = this.id(input.tableId, "tableId"),
      rowId = this.id(input.rowId, "rowId"),
      cells = this.parseCells(input.cells),
      idempotencyKey = this.key(input.idempotencyKey);
    const query = input.disableParsing === true ? "?disableParsing=true" : "";
    const value = await this.request(
      credentials,
      "PUT",
      `/docs/${this.path(docId)}/tables/${this.path(tableId)}/rows/${this.path(rowId)}${query}`,
      { row: { cells } },
    );
    return {
      docId,
      tableId,
      rowId,
      requestId: this.text(value.requestId),
      id: this.text(value.id),
      idempotencyKey,
      queued: true,
      providerRequestCount: 1,
    };
  }

  private async request(
    credentials: CodaCredentials,
    method: string,
    path: string,
    body?: JsonObject,
  ): Promise<JsonObject> {
    this.credentials(credentials);
    let response: Response;
    try {
      response = await safeConnectorFetch(`${this.origin}${path}`, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.apiToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new CodaApiError(
        "provider_unavailable",
        "Coda could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new CodaApiError(
        "provider_validation_error",
        "Coda response exceeded Relay bounds.",
      );
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      value = {};
    }
    if (!response.ok)
      throw new CodaApiError(
        this.code(response.status),
        response.status === 429
          ? "Coda rate limit reached; retry later."
          : "Coda rejected the request.",
        response.status,
      );
    return value;
  }
  private collection(value: JsonObject, max: number, key: string) {
    const items = this.array(value.items)
      .slice(0, max)
      .map((item) => this.safe(item, 60_000));
    return {
      [key]: items,
      count: items.length,
      nextPageAvailable: Boolean(this.text(value.nextPageToken)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  private parseCells(value: unknown) {
    const entries = this.array(value);
    if (!entries.length || entries.length > 50)
      throw new CodaApiError(
        "provider_validation_error",
        "Coda cells must contain between one and fifty entries.",
      );
    const cells = entries.map((entry) => {
      const cell = this.object(entry),
        column = this.id(cell.column, "column");
      if (!("value" in cell))
        throw new CodaApiError(
          "provider_validation_error",
          "Each Coda cell requires a value.",
        );
      return { column, value: this.safeCell(cell.value) };
    });
    if (JSON.stringify(cells).length > 50_000)
      throw new CodaApiError(
        "provider_validation_error",
        "Coda row change exceeds Relay bounds.",
      );
    return cells;
  }
  private safeCell(value: unknown): unknown {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      return typeof value === "string" ? value.slice(0, 10_000) : value;
    if (Array.isArray(value) && value.length <= 100)
      return value.map((item) => this.safeCell(item));
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const object = value as JsonObject;
      if (
        Object.keys(object).some((key) =>
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          ),
        )
      )
        throw new CodaApiError(
          "policy_blocked",
          "Credential-bearing Coda cell fields are not allowed.",
          403,
        );
      return Object.fromEntries(
        Object.entries(object)
          .slice(0, 50)
          .map(([key, item]) => [key.slice(0, 180), this.safeCell(item)]),
      );
    }
    throw new CodaApiError(
      "provider_validation_error",
      "Coda cell value is unsupported.",
    );
  }
  private credentials(value: CodaCredentials) {
    if (!value.apiToken || value.apiToken.length > 4_000)
      throw new CodaApiError(
        "credential_missing",
        "A Coda API token is required.",
        401,
      );
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private id(value: unknown, name: string) {
    const text = this.text(value);
    if (!text || text.length > 180 || !/^[A-Za-z0-9_.:@+-]+$/.test(text))
      throw new CodaApiError(
        "provider_validation_error",
        `Coda ${name} is invalid.`,
      );
    return text;
  }
  private key(value: unknown) {
    const text = this.text(value);
    if (!text || text.length > 180)
      throw new CodaApiError(
        "provider_validation_error",
        "Coda idempotencyKey is required.",
      );
    return text;
  }
  private path(value: string) {
    return encodeURIComponent(value);
  }
  private limit(value: unknown, fallback: number, max: number) {
    const number = Number(value);
    return Number.isInteger(number)
      ? Math.max(1, Math.min(max, number))
      : fallback;
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private safe(value: unknown, limit: number) {
    const encoded = JSON.stringify(value ?? {});
    return encoded.length <= limit
      ? (value ?? {})
      : { truncated: true, preview: encoded.slice(0, limit) };
  }
  private fail(message: string): never {
    throw new CodaApiError("provider_validation_error", `Coda ${message}.`);
  }
}
