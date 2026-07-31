import { Injectable } from "@nestjs/common";

export type PipedriveApiCredentials = { accessToken: string; companyId: string; apiOrigin: string };

export class PipedriveApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode?: number, public readonly details?: Record<string, unknown>) { super(message); }
}

type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ID = /^[1-9][0-9]{0,19}$/;

@Injectable()
export class PipedriveApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: PipedriveApiCredentials) {
    const result = await this.listOrganizations(credentials, { limit: 1 });
    return { companyId: credentials.companyId, apiVersion: "v2", reachable: Array.isArray(result.organizations) };
  }

  async listOrganizations(credentials: PipedriveApiCredentials, input: Record<string, unknown>) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/api/v2/organizations", { limit, sort_by: "update_time", sort_direction: "desc" });
    return { companyId: credentials.companyId, organizations: this.rows(body).slice(0, limit).map((row) => ({ organizationId: this.scalar(row.id), name: this.scalar(row.name), addedAt: this.scalar(row.add_time), updatedAt: this.scalar(row.update_time) })) };
  }

  async listDeals(credentials: PipedriveApiCredentials, input: Record<string, unknown>) {
    const limit = this.limit(input.limit);
    const body = await this.send(credentials, "/api/v2/deals", { limit, sort_by: "update_time", sort_direction: "desc" });
    return { companyId: credentials.companyId, deals: this.rows(body).slice(0, limit).map((row) => this.deal(row)) };
  }

  async getDeal(credentials: PipedriveApiCredentials, input: Record<string, unknown>) {
    if (typeof input.dealId !== "string" || !ID.test(input.dealId)) throw new PipedriveApiError("pipedrive_deal_id_invalid", "A positive numeric Pipedrive Deal ID is required.");
    const body = await this.send(credentials, `/api/v2/deals/${input.dealId}`, {});
    return { companyId: credentials.companyId, deal: this.deal(this.object(body.data)) };
  }

  private async send(credentials: PipedriveApiCredentials, path: string, query: Record<string, string | number>) {
    if (!ID.test(credentials.companyId)) throw new PipedriveApiError("pipedrive_company_binding_invalid", "Pipedrive connection is not bound to a valid company ID.");
    if (!credentials.accessToken.trim()) throw new PipedriveApiError("pipedrive_token_invalid", "Pipedrive connection token is missing.");
    const origin = this.origin(credentials.apiOrigin);
    const url = new URL(path, origin);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    let response: Response;
    try {
      response = await this.request(url.toString(), { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${credentials.accessToken}` }, redirect: "error", signal: AbortSignal.timeout(20_000) });
    } catch { throw new PipedriveApiError("pipedrive_unavailable", "Pipedrive is temporarily unavailable."); }
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new PipedriveApiError("pipedrive_response_too_large", "Pipedrive response exceeded the safe size limit.");
    let body: Record<string, unknown> = {};
    try { const parsed = raw ? JSON.parse(raw) : {}; if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed; }
    catch { throw new PipedriveApiError("pipedrive_response_invalid", "Pipedrive returned an invalid response."); }
    if (!response.ok || body.success === false) throw new PipedriveApiError(response.status === 401 ? "pipedrive_token_invalid" : response.status === 403 ? "pipedrive_permission_denied" : response.status === 429 ? "pipedrive_rate_limited" : "pipedrive_http_error", "Pipedrive API request failed.", response.status, { error: this.scalar(body.error), retryAfter: response.headers.get("retry-after") });
    return body;
  }

  private origin(value: string) {
    try { const url = new URL(value); const host = url.hostname.toLowerCase(); if (url.protocol !== "https:" || !host.endsWith(".pipedrive.com") || host === "pipedrive.com" || url.username || url.password || url.port || (url.pathname !== "/" && url.pathname !== "") || url.search || url.hash) throw new Error(); return url.origin; }
    catch { throw new PipedriveApiError("pipedrive_api_origin_invalid", "Pipedrive API domain binding is invalid."); }
  }
  private rows(body: Record<string, unknown>) { return Array.isArray(body.data) ? body.data.map((value) => this.object(value)) : []; }
  private deal(row: Record<string, unknown>) { return { dealId: this.scalar(row.id), title: this.scalar(row.title), value: this.scalar(row.value), currency: this.scalar(row.currency), status: this.scalar(row.status), stageId: this.scalar(row.stage_id), pipelineId: this.scalar(row.pipeline_id), organizationId: this.scalar(row.org_id), expectedCloseDate: this.scalar(row.expected_close_date), addedAt: this.scalar(row.add_time), updatedAt: this.scalar(row.update_time) }; }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private scalar(value: unknown): string | number | boolean | null { if (typeof value === "string") return value.slice(0, 512); if (typeof value === "number" && Number.isFinite(value)) return value; if (typeof value === "boolean") return value; return null; }
  private limit(value: unknown) { if (value === undefined) return 25; if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 25) throw new PipedriveApiError("pipedrive_input_invalid", "Pipedrive result limit is outside the supported range."); return Number(value); }
}
