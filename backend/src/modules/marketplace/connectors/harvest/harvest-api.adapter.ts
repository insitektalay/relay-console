import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type HarvestCredentials = {
  accessToken: string;
  accountId: string;
  userId: string;
};

export class HarvestApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class HarvestApiAdapter {
  private readonly apiOrigin = "https://api.harvestapp.com/v2";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: HarvestCredentials) {
    const user = this.record(
      await this.rawRequest(credentials, { method: "GET", path: "/users/me" }),
    );
    const userId = this.id(user.id, "user");
    if (userId !== credentials.userId)
      throw new HarvestApiError(
        "provider_validation_error",
        "Harvest returned a different authorizing user for the bound account.",
      );
    return {
      userId,
      accountId: credentials.accountId,
      apiOrigin: this.apiOrigin,
    };
  }

  async listProjectAssignments(
    credentials: HarvestCredentials,
    input: { limit?: number } = {},
  ) {
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/users/me/project_assignments",
        query: { is_active: true, per_page: this.limit(input.limit) },
      }),
    );
    return {
      projectAssignments: (Array.isArray(body.project_assignments)
        ? body.project_assignments
        : []
      )
        .slice(0, this.limit(input.limit))
        .map((item) => this.projectAssignment(item)),
    };
  }

  async listTimeEntries(
    credentials: HarvestCredentials,
    input: { from: string; to: string; limit?: number },
  ) {
    const from = this.dateInput(input.from, "from");
    const to = this.dateInput(input.to, "to");
    const span =
      Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    if (span < 0 || span > 90 * 24 * 60 * 60 * 1000)
      throw this.invalid(
        "Harvest time-entry windows must be between zero and ninety days.",
      );
    const body = this.record(
      await this.rawRequest(credentials, {
        method: "GET",
        path: "/time_entries",
        query: {
          user_id: credentials.userId,
          from,
          to,
          per_page: this.limit(input.limit),
        },
      }),
    );
    return {
      timeEntries: (Array.isArray(body.time_entries) ? body.time_entries : [])
        .slice(0, this.limit(input.limit))
        .map((item) => this.timeEntry(item)),
    };
  }

  async getTimeEntry(
    credentials: HarvestCredentials,
    input: { timeEntryId: number },
  ) {
    const timeEntry = this.timeEntry(
      await this.rawRequest(credentials, {
        method: "GET",
        path: `/time_entries/${this.positiveInteger(input.timeEntryId, "timeEntryId")}`,
      }),
    );
    if (timeEntry.userId !== credentials.userId)
      throw new HarvestApiError(
        "insufficient_scope",
        "That Harvest time entry does not belong to the connected user.",
        403,
      );
    return { timeEntry };
  }

  async request(
    credentials: HarvestCredentials,
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
    credentials: HarvestCredentials,
    input: {
      method: string;
      path: string;
      query?: JsonObject;
      json?: JsonObject;
    },
  ) {
    const accessToken = credentials.accessToken.trim();
    const accountId = this.id(credentials.accountId, "account");
    if (
      !accessToken ||
      accessToken.length > 32_000 ||
      /[\r\n]/.test(accessToken)
    )
      throw new HarvestApiError(
        "credential_missing",
        "A valid Harvest OAuth access token is required.",
        401,
      );
    const method = input.method.toUpperCase();
    if (
      !/^(GET|POST|PATCH|DELETE)$/.test(method) ||
      !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) ||
      input.path.includes("..") ||
      input.path.includes("://") ||
      input.path.includes("//")
    )
      throw this.invalid("Harvest method or relative API path is invalid.");
    if (/^\/(oauth|auth|tokens?|accounts)(\/|$)/i.test(input.path))
      throw new HarvestApiError(
        "policy_blocked",
        "Harvest authentication, token and account-discovery routes are not agent tools.",
        403,
      );
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const serialized = input.json ? JSON.stringify(input.json) : undefined;
    if (serialized && Buffer.byteLength(serialized, "utf8") > 1_000_000)
      throw this.invalid(
        "Harvest request body exceeds the 1 MB Relay boundary.",
      );
    const url = new URL(input.path.slice(1), `${this.apiOrigin}/`);
    this.appendQuery(url.searchParams, input.query);
    let response: Response;
    try {
      response = await this.requester(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Harvest-Account-Id": accountId,
          ...(serialized ? { "Content-Type": "application/json" } : {}),
          "User-Agent": "RelayConsole-Harvest/1.0 (support@relayconsole.com)",
        },
        body: serialized,
      });
    } catch (error) {
      if (error instanceof HarvestApiError) throw error;
      throw new HarvestApiError(
        "provider_unavailable",
        "Harvest could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.invalid("Harvest response exceeds the 2 MB Relay boundary.");
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = raw.slice(0, 10_000);
    }
    if (!response.ok)
      throw new HarvestApiError(
        this.safeCode(response.status),
        this.errorMessage(body) ?? `Harvest returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private projectAssignment(value: unknown) {
    const item = this.record(value);
    const project = this.record(item.project);
    const client = this.record(project.client);
    return {
      projectAssignmentId: this.id(item.id, "project assignment"),
      projectId: this.id(project.id, "project"),
      projectName: this.text(project.name, 1_000),
      projectCode: this.text(project.code, 500) || null,
      clientId: this.optionalId(client.id),
      clientName: this.text(client.name, 1_000) || null,
      active: item.is_active !== false,
      projectManager: item.is_project_manager === true,
      updatedAt: this.dateTime(item.updated_at),
    };
  }

  private timeEntry(value: unknown) {
    const item = this.record(value);
    const user = this.record(item.user);
    const project = this.record(item.project);
    const client = this.record(item.client);
    const task = this.record(item.task);
    return {
      timeEntryId: this.id(item.id, "time entry"),
      userId: this.id(user.id, "user"),
      spentDate: this.dateInput(String(item.spent_date ?? ""), "spentDate"),
      hours: this.number(item.hours),
      running: item.is_running === true,
      billed: item.is_billed === true,
      billable: item.billable === true,
      projectId: this.optionalId(project.id),
      projectName: this.text(project.name, 1_000) || null,
      clientId: this.optionalId(client.id),
      clientName: this.text(client.name, 1_000) || null,
      taskId: this.optionalId(task.id),
      taskName: this.text(task.name, 1_000) || null,
      notes: this.text(item.notes, 20_000),
      createdAt: this.dateTime(item.created_at),
      updatedAt: this.dateTime(item.updated_at),
    };
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12)
        throw new HarvestApiError(
          "policy_blocked",
          "Harvest request is too deeply nested.",
          403,
        );
      if (Array.isArray(item))
        return void item.forEach((entry) => walk(entry, depth + 1));
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key|account.?id)/i.test(
            key,
          )
        )
          throw new HarvestApiError(
            "policy_blocked",
            `Credential or account-binding field ${key} is not allowed.`,
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
      throw this.invalid("Harvest query has too many fields.");
    for (const [key, item] of Object.entries(value)) {
      if (!/^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(key))
        throw this.invalid(`Harvest query parameter ${key} is invalid.`);
      if (item === undefined || item === null || item === "") continue;
      const values = Array.isArray(item) ? item : [item];
      if (values.length > 100)
        throw this.invalid(`Harvest query ${key} has too many values.`);
      for (const entry of values) {
        if (typeof entry === "object")
          throw this.invalid(`Harvest query ${key} must be scalar.`);
        const text = String(entry);
        if (text.length > 2_000 || /[\r\n]/.test(text))
          throw this.invalid(`Harvest query ${key} is invalid.`);
        params.append(key, text);
      }
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 10) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value))
      return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 500)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: unknown) {
    const item = this.record(value);
    return (
      this.text(item.error, 1_000) || this.text(item.message, 1_000) || null
    );
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    return status >= 500 ? "provider_unavailable" : "provider_validation_error";
  }

  private dateInput(value: string, name: string) {
    const text = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text)))
      throw this.invalid(`Harvest ${name} must be an ISO 8601 date.`);
    return text;
  }

  private positiveInteger(value: unknown, name: string) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw this.invalid(`Harvest ${name} must be a positive integer.`);
    return number;
  }

  private id(value: unknown, kind: string) {
    const text = String(value ?? "");
    if (!/^[1-9]\d{0,18}$/.test(text))
      throw this.invalid(`Harvest ${kind} ID is invalid.`);
    return text;
  }

  private optionalId(value: unknown) {
    return value === null || value === undefined || value === ""
      ? null
      : this.id(value, "resource");
  }

  private limit(value?: number) {
    return Math.min(
      25,
      Math.max(1, Number.isInteger(value) ? Number(value) : 25),
    );
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private dateTime(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private invalid(message: string) {
    return new HarvestApiError("provider_validation_error", message, 400);
  }
}
