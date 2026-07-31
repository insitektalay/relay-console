import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type SmartsheetCredentials = {
  accessToken: string;
  apiOrigin: string;
  accountId: string;
  userId: string;
};

export class SmartsheetApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SmartsheetApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: SmartsheetCredentials) {
    const user = this.record(
      await this.rawRequest(credentials, { method: "GET", path: "/users/me" }),
    );
    const userId = this.numericId(user.id, "user");
    const accountId = this.numericId(this.record(user.account).id, "account");
    if (userId !== credentials.userId || accountId !== credentials.accountId)
      throw new SmartsheetApiError(
        "insufficient_scope",
        "Smartsheet account or authorizing-user binding changed.",
        403,
      );
    return {
      accountId,
      userId,
      apiOrigin: this.apiOrigin(credentials.apiOrigin),
    };
  }

  async listSheets(
    credentials: SmartsheetCredentials,
    input: { limit?: number } = {},
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/sheets",
        query: { page: 1, pageSize: limit },
      }),
    );
    return {
      sheets: this.array(body.data)
        .slice(0, limit)
        .map((item) => this.sheet(item)),
    };
  }

  async getSheet(
    credentials: SmartsheetCredentials,
    input: { sheetId: string; limit?: number },
  ) {
    const limit = this.limit(input.limit);
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: `/sheets/${this.numericId(input.sheetId, "sheet")}`,
        query: { page: 1, pageSize: limit },
      }),
    );
    return {
      sheet: {
        ...this.sheet(body),
        columns: this.array(body.columns)
          .slice(0, 200)
          .map((item) => this.column(item)),
        rows: this.array(body.rows)
          .slice(0, limit)
          .map((item) => this.row(item)),
      },
    };
  }

  async getRow(
    credentials: SmartsheetCredentials,
    input: { sheetId: string; rowId: string },
  ) {
    const sheetId = this.numericId(input.sheetId, "sheet");
    const rowId = this.numericId(input.rowId, "row");
    return {
      row: this.row(
        await this.rawRequest(credentials, {
          method: "GET",
          path: `/sheets/${sheetId}/rows/${rowId}`,
        }),
      ),
    };
  }

  async request(
    credentials: SmartsheetCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    return { data: this.redact(await this.rawRequest(credentials, input)) };
  }

  private async rawRequest(
    credentials: SmartsheetCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    if (!credentials.accessToken.trim())
      throw new SmartsheetApiError(
        "credential_missing",
        "Smartsheet access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw new SmartsheetApiError(
        "provider_validation_error",
        "Smartsheet method or relative API path is invalid.",
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw new SmartsheetApiError(
        "provider_validation_error",
        "Smartsheet request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(
      input.path.slice(1),
      `${this.apiOrigin(credentials.apiOrigin)}/`,
    );
    this.appendQuery(url.searchParams, input.query);
    return this.response(
      await this.requester(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
          "smartsheet-integration-source": "AI,Relay Console,Marketplace",
        },
        body: serialized,
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new SmartsheetApiError(
        "provider_validation_error",
        "Smartsheet response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new SmartsheetApiError(
        "provider_validation_error",
        "Smartsheet response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new SmartsheetApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ??
          `Smartsheet returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private apiOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new SmartsheetApiError(
        "credential_missing",
        "Smartsheet API origin is missing.",
      );
    }
    const hosts = new Set([
      "api.smartsheet.com",
      "api.smartsheet.eu",
      "api.smartsheet.au",
      "api.smartsheetgov.com",
    ]);
    if (
      url.protocol !== "https:" ||
      !hosts.has(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname.replace(/\/+$/, "") !== "/2.0" ||
      url.search ||
      url.hash
    )
      throw new SmartsheetApiError(
        "credential_missing",
        "Smartsheet API origin is invalid.",
      );
    return `${url.origin}/2.0`;
  }

  private sheet(value: unknown) {
    const item = this.record(value);
    return {
      sheetId: this.numericId(item.id, "sheet"),
      name: this.text(item.name, 500),
      accessLevel: this.text(item.accessLevel, 100),
      permalink: this.text(item.permalink, 2000),
      createdAt: this.date(item.createdAt),
      modifiedAt: this.date(item.modifiedAt),
    };
  }
  private column(value: unknown) {
    const item = this.record(value);
    return {
      columnId: this.numericId(item.id, "column"),
      title: this.text(item.title, 500),
      type: this.text(item.type, 100),
      index: this.number(item.index),
    };
  }
  private row(value: unknown) {
    const item = this.record(value);
    return {
      rowId: this.numericId(item.id, "row"),
      rowNumber: this.number(item.rowNumber),
      expanded: item.expanded === true,
      createdAt: this.date(item.createdAt),
      modifiedAt: this.date(item.modifiedAt),
      cells: this.array(item.cells)
        .slice(0, 200)
        .map((cell) => {
          const record = this.record(cell);
          return {
            columnId: this.numericId(record.columnId, "column"),
            value: this.scalar(record.value),
            displayValue: this.text(record.displayValue, 10_000),
          };
        }),
    };
  }
  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new SmartsheetApiError(
          "policy_blocked",
          "Smartsheet request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return void item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        )
          throw new SmartsheetApiError(
            "policy_blocked",
            `Credential-bearing field ${key} is not allowed.`,
            403,
          );
        walk(entry, depth + 1);
      }
    };
    walk(value);
  }
  private appendQuery(params: URLSearchParams, value?: JsonObject) {
    if (!value) return;
    if (Object.keys(value).length > 50)
      throw new SmartsheetApiError(
        "provider_validation_error",
        "Smartsheet query has too many fields.",
      );
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item.slice(0, 100) : [item];
      values.forEach((entry) =>
        params.append(key.slice(0, 200), String(entry).slice(0, 10_000)),
      );
    }
  }
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    const out: JsonObject = {};
    for (const [key, item] of Object.entries(value as JsonObject).slice(0, 500))
      out[key] =
        /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
          key,
        )
          ? "[redacted]"
          : this.redact(item, depth + 1);
    return out;
  }
  private errorMessage(value: unknown) {
    const body = this.record(value);
    return this.text(body.message, 1000) || this.text(body.errorCode, 1000);
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }
  private limit(value?: number) {
    return Math.min(
      25,
      Math.max(1, Number.isInteger(value) ? Number(value) : 25),
    );
  }
  private numericId(value: unknown, kind: string) {
    const id = String(value ?? "");
    if (!/^[1-9][0-9]{0,24}$/.test(id))
      throw new SmartsheetApiError(
        "provider_validation_error",
        `Smartsheet ${kind} ID is invalid.`,
      );
    return id;
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }
  private scalar(value: unknown) {
    return ["string", "number", "boolean"].includes(typeof value) ||
      value === null
      ? value
      : null;
  }
  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }
  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
}
