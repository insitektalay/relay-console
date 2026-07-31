import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;
export type ZephyrScaleCredentials = { apiToken: string; region: string; projectKey: string };

export class ZephyrScaleApiError extends Error {
  constructor(public readonly code: MarketplaceConnectorSafeErrorCode, message: string, public readonly statusCode?: number) { super(message); }
}

export class ZephyrScaleApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ZephyrScaleCredentials) {
    await this.rawRequest(credentials, { method: "GET", path: "/testcases", query: { projectKey: this.project(credentials.projectKey), maxResults: 1, startAt: 0 } });
    return { region: this.region(credentials.region), projectKey: this.project(credentials.projectKey), apiOrigin: this.origin(credentials.region) };
  }

  async listTestCases(credentials: ZephyrScaleCredentials, input: { limit?: number } = {}) {
    return this.bounded(await this.rawRequest(credentials, { method: "GET", path: "/testcases", query: { projectKey: this.project(credentials.projectKey), maxResults: this.limit(input.limit), startAt: 0 } }), "testCases");
  }

  async getTestCase(credentials: ZephyrScaleCredentials, testCaseKey: string) {
    const expected = this.project(credentials.projectKey);
    if (!new RegExp(`^${expected}-T[1-9]\\d*$`).test(testCaseKey)) throw this.invalid("Zephyr Scale testCaseKey must belong to the bound Jira project.");
    return { testCase: this.redact(await this.rawRequest(credentials, { method: "GET", path: `/testcases/${testCaseKey}` })) };
  }

  async listTestCycles(credentials: ZephyrScaleCredentials, input: { limit?: number } = {}) {
    return this.bounded(await this.rawRequest(credentials, { method: "GET", path: "/testcycles", query: { projectKey: this.project(credentials.projectKey), maxResults: this.limit(input.limit), startAt: 0 } }), "testCycles");
  }

  async request(credentials: ZephyrScaleCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    return { data: this.redact(await this.rawRequest(credentials, input)) };
  }

  private async rawRequest(credentials: ZephyrScaleCredentials, input: { method: string; path: string; query?: JsonObject; json?: JsonObject }) {
    this.project(credentials.projectKey);
    const token = credentials.apiToken.trim();
    if (token.length < 16 || token.length > 16_000 || /[\r\n]/.test(token)) throw new ZephyrScaleApiError("credential_missing", "A valid Zephyr Scale API token is required.", 401);
    const method = input.method.toUpperCase();
    if (!/^(GET|POST|PUT|DELETE)$/.test(method) || !/^\/[A-Za-z0-9_./:@+-]*$/.test(input.path) || input.path.includes("..") || input.path.includes("://") || input.path.includes("//")) throw this.invalid("Zephyr Scale method or relative API path is invalid.");
    if (/(^|\/)(api[-_]?keys?|tokens?|oauth|authentication|sessions?)(\/|$)/i.test(input.path)) throw new ZephyrScaleApiError("policy_blocked", "Zephyr Scale credential lifecycle routes are not agent tools.", 403);
    this.rejectCredentialFields(input.query); this.rejectCredentialFields(input.json);
    const body = input.json === undefined ? undefined : JSON.stringify(input.json);
    if (body && Buffer.byteLength(body, "utf8") > 1_000_000) throw this.invalid("Zephyr Scale request body exceeds the 1 MB Relay boundary.");
    const url = new URL(input.path.slice(1), `${this.origin(credentials.region)}/`);
    this.appendQuery(url.searchParams, input.query);
    let response: Response;
    try {
      response = await this.requester(url, { method, redirect: "error", signal: AbortSignal.timeout(method === "GET" ? 20_000 : 30_000), cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}), "User-Agent": "RelayConsole-ZephyrScale/1.0" }, body });
    } catch (error) {
      if (error instanceof ZephyrScaleApiError) throw error;
      throw new ZephyrScaleApiError("provider_unavailable", "Zephyr Scale could not be reached.", 502);
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000) throw this.invalid("Zephyr Scale response exceeds the 2 MB Relay boundary.");
    let data: unknown = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = raw.slice(0, 10_000); }
    if (!response.ok) throw new ZephyrScaleApiError(this.safeCode(response.status), this.errorMessage(data) ?? `Zephyr Scale returned HTTP ${response.status}.`, response.status);
    return data;
  }

  private origin(region: string) {
    const origins: Record<string, string> = { US: "https://api.zephyrscale.smartbear.com/v2", EU: "https://eu.api.zephyrscale.smartbear.com/v2", AU: "https://au.api.zephyrscale.smartbear.com/v2", DE: "https://de.api.zephyrscale.smartbear.com/v2" };
    const origin = origins[this.region(region)]; if (!origin) throw this.invalid("Zephyr Scale region is invalid."); return origin;
  }
  private region(value: string) { const region = value.trim().toUpperCase(); if (!/^(US|EU|AU|DE)$/.test(region)) throw this.invalid("Zephyr Scale region must be US, EU, AU or DE."); return region; }
  private project(value: string) { const project = value.trim().toUpperCase(); if (!/^[A-Z][A-Z0-9_]{0,49}$/.test(project)) throw this.invalid("Zephyr Scale Jira project key is invalid."); return project; }
  private limit(value?: number) { return Number.isInteger(value) && value! >= 1 && value! <= 25 ? value! : 25; }
  private bounded(value: unknown, label: string) { const record = this.record(value); const values = Array.isArray(record.values) ? record.values : []; return { [label]: this.redact(values.slice(0, 25)), pagination: { startAt: record.startAt ?? 0, maxResults: record.maxResults ?? values.length, total: record.total ?? null } }; }
  private record(value: unknown): JsonObject { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
  private appendQuery(target: URLSearchParams, query?: JsonObject) { for (const [key, raw] of Object.entries(query ?? {})) { if (!/^[A-Za-z][A-Za-z0-9_-]{0,100}$/.test(key)) throw this.invalid("Zephyr Scale query key is invalid."); for (const value of Array.isArray(raw) ? raw : [raw]) { if (value === undefined || value === null || value === "") continue; if (typeof value === "object") throw this.invalid(`Zephyr Scale query ${key} must be scalar.`); const text = String(value); if (text.length > 2_000 || /[\r\n]/.test(text)) throw this.invalid(`Zephyr Scale query ${key} is invalid.`); target.append(key, text); } } }
  private rejectCredentialFields(value: unknown, depth = 0): void { if (depth > 10) throw new ZephyrScaleApiError("policy_blocked", "Zephyr Scale request is too deeply nested.", 403); if (Array.isArray(value)) return value.forEach((item) => this.rejectCredentialFields(item, depth + 1)); if (!value || typeof value !== "object") return; for (const [key, item] of Object.entries(value as JsonObject)) { if (/(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key)) throw new ZephyrScaleApiError("policy_blocked", `Credential-bearing field ${key} is not allowed.`, 403); this.rejectCredentialFields(item, depth + 1); } }
  private redact(value: unknown, depth = 0): unknown { if (depth > 12) return "[TRUNCATED]"; if (Array.isArray(value)) return value.slice(0, 500).map((item) => this.redact(item, depth + 1)); if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 20_000) : value; return Object.fromEntries(Object.entries(value as JsonObject).slice(0, 500).map(([key, item]) => [key, /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(key) ? "[REDACTED]" : this.redact(item, depth + 1)])); }
  private errorMessage(value: unknown) { const record = this.record(value); for (const candidate of [record.message, record.error, record.errorMessage]) if (typeof candidate === "string" && candidate.trim()) return candidate.slice(0, 1_000); return null; }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode { if (status === 401) return "credential_missing"; if (status === 403) return "insufficient_scope"; if ([400, 404, 409, 422].includes(status)) return "provider_validation_error"; if (status === 429) return "provider_rate_limited"; return "provider_unavailable"; }
  private invalid(message: string) { return new ZephyrScaleApiError("provider_validation_error", message, 400); }
}
