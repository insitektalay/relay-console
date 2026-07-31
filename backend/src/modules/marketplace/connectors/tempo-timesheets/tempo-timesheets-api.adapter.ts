import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type TempoTimesheetsCredentials = { apiToken: string; jiraSiteUrl: string };

export class TempoTimesheetsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TempoTimesheetsApiAdapter {
  private static readonly ORIGIN = "https://api.tempo.io";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: TempoTimesheetsCredentials) {
    const siteHost = this.siteHost(credentials.jiraSiteUrl);
    await this.rawRequest(credentials, { method: "GET", path: "/worklogs", query: { limit: 1 } });
    return { siteHost, apiOrigin: `${TempoTimesheetsApiAdapter.ORIGIN}/4` };
  }

  async listWorklogs(credentials: TempoTimesheetsCredentials, input: { from: string; to: string; limit?: number }) {
    const from = this.date(input.from, "from");
    const to = this.date(input.to, "to");
    const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    if (span < 0 || span > 90 * 86_400_000)
      throw this.invalid("Tempo worklog windows must be between zero and ninety days.");
    return this.bounded(await this.rawRequest(credentials, { method: "GET", path: "/worklogs", query: { from, to, limit: this.limit(input.limit), offset: 0 } }), "worklogs");
  }

  async getWorklog(credentials: TempoTimesheetsCredentials, worklogId: string) {
    return { worklog: this.redact(await this.rawRequest(credentials, { method: "GET", path: `/worklogs/${this.id(worklogId, "worklogId")}` })) };
  }

  async listAccounts(credentials: TempoTimesheetsCredentials, input: { limit?: number } = {}) {
    return this.bounded(await this.rawRequest(credentials, { method: "GET", path: "/accounts", query: { limit: this.limit(input.limit), offset: 0 } }), "accounts");
  }

  async searchPlans(credentials: TempoTimesheetsCredentials, input: { from: string; to: string; limit?: number }) {
    const from = this.date(input.from, "from");
    const to = this.date(input.to, "to");
    const span = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
    if (span < 0 || span > 90 * 86_400_000)
      throw this.invalid("Tempo Planner search windows must be between zero and ninety days.");
    return this.bounded(await this.rawRequest(credentials, { method: "POST", path: "/plans/search", json: { from, to, limit: this.limit(input.limit), offset: 0 } }), "plans");
  }

  async request(credentials: TempoTimesheetsCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    return { data: this.redact(await this.rawRequest(credentials, input)) };
  }

  private async rawRequest(credentials: TempoTimesheetsCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.siteHost(credentials.jiraSiteUrl);
    const token = credentials.apiToken.trim();
    if (token.length < 16 || token.length > 16_000 || /[\r\n]/.test(token))
      throw new TempoTimesheetsApiError("credential_missing", "A valid Tempo API token is required.", 401);
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|PATCH|DELETE)$/.test(method) || !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) || input.path.includes("..") || input.path.includes("://") || input.path.includes("//"))
      throw this.invalid("Tempo method or relative API v4 path is invalid.");
    if (/(^|\/)(oauth|tokens?|authentication|webhooks?\/subscriptions)(\/|$)/i.test(input.path))
      throw new TempoTimesheetsApiError("policy_blocked", "Tempo credential and webhook lifecycle routes are not agent tools.", 403);
    this.rejectCredentialFields(input.query);
    this.rejectCredentialFields(input.json);
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000)
      throw this.invalid("Tempo request body exceeds the 1 MB Relay boundary.");
    const url = new URL(`/4${input.path}`, TempoTimesheetsApiAdapter.ORIGIN);
    this.appendQuery(url.searchParams, input.query);
    let response: Response;
    try {
      response = await this.requester(url, {
        method,
        redirect: "error",
        signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000),
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), "User-Agent": "RelayConsole-TempoTimesheets/1.0" },
        body,
      });
    } catch (error) {
      if (error instanceof TempoTimesheetsApiError) throw error;
      throw new TempoTimesheetsApiError("provider_unavailable", "Tempo could not be reached.", 502);
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.invalid("Tempo response exceeds the 2 MB Relay boundary.");
    let data: unknown = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 10_000); }
    if (!response.ok)
      throw new TempoTimesheetsApiError(this.safeCode(response.status), this.errorMessage(data) ?? `Tempo returned HTTP ${response.status}.`, response.status);
    return data;
  }

  private bounded(value: unknown, label: string) {
    const record = this.record(value);
    const values = Array.isArray(record.results) ? record.results : Array.isArray(value) ? value : [];
    return { [label]: this.redact(values.slice(0, 25)), metadata: this.redact(record.metadata ?? null) };
  }

  private siteHost(value: string) {
    let url: URL;
    try { url = new URL(value.trim()); } catch { throw this.invalid("Tempo Jira site URL is invalid."); }
    if (url.protocol !== "https:" || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/.test(url.hostname.toLowerCase()) || url.port || url.username || url.password || url.search || url.hash || !/^\/?$/.test(url.pathname))
      throw this.invalid("Tempo Jira site URL must be an exact HTTPS *.atlassian.net origin.");
    return url.hostname.toLowerCase();
  }

  private date(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
      throw this.invalid(`Tempo ${label} must be an ISO calendar date.`);
    return value;
  }

  private id(value: string, label: string) {
    if (!/^[1-9]\d{0,18}$/.test(value)) throw this.invalid(`Tempo ${label} is invalid.`);
    return value;
  }

  private limit(value?: number) { return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25; }
  private record(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private appendQuery(target: URLSearchParams, query?: JsonObject) {
    for (const [key, raw] of Object.entries(query ?? {})) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,100}$/.test(key)) throw this.invalid("Tempo query key is invalid.");
      for (const value of Array.isArray(raw) ? raw : [raw]) {
        if (value === undefined || value === null || value === "") continue;
        if (typeof value === "object") throw this.invalid(`Tempo query ${key} must be scalar.`);
        const text = String(value);
        if (text.length > 2_000 || /[\r\n]/.test(text)) throw this.invalid(`Tempo query ${key} is invalid.`);
        target.append(key, text);
      }
    }
  }

  private rejectCredentialFields(value: unknown, depth = 0): void {
    if (depth > 10) throw new TempoTimesheetsApiError("policy_blocked", "Tempo request is too deeply nested.", 403);
    if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1));
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as JsonObject)) {
      if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key))
        throw new TempoTimesheetsApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403);
      this.rejectCredentialFields(item, depth + 1);
    }
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 12) return "[TRUNCATED]";
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item, depth + 1));
    if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 20_000) : value;
    return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key) ? "[REDACTED]" : this.redact(item, depth + 1)]));
  }

  private errorMessage(value: unknown) {
    const record = this.record(value);
    for (const candidate of [record.message, record.error, record.errorMessage])
      if (typeof candidate === "string" && candidate.trim()) return candidate.slice(0, 1_000);
    return null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404 || status === 400 || status === 409 || status === 422) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    return "provider_unavailable";
  }

  private invalid(message: string) { return new TempoTimesheetsApiError("provider_validation_error", message, 400); }
}
