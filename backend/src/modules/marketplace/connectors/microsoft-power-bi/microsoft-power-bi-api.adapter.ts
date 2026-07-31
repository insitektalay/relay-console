import { Injectable } from "@nestjs/common";
export class MicrosoftPowerBIApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
export type MicrosoftPowerBIBinding = { workspaceId: string };
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ORIGIN = "https://api.powerbi.com";
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
@Injectable()
export class MicrosoftPowerBIApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}
  async health(token: string, binding: MicrosoftPowerBIBinding) {
    const value = await this.getWorkspace(token, binding);
    return { reachable: true, workspaceId: value.workspace.id };
  }
  async getWorkspace(token: string, binding: MicrosoftPowerBIBinding) {
    return {
      workspace: this.workspace(
        this.object(await this.get(token, binding, "")),
      ),
    };
  }
  async listReports(token: string, binding: MicrosoftPowerBIBinding) {
    const rows = this.rows(await this.get(token, binding, "/reports")).map(
      (r) => this.report(r),
    );
    return { reports: rows, resultCount: rows.length, nextPageFollowed: false };
  }
  async listSemanticModels(token: string, binding: MicrosoftPowerBIBinding) {
    const rows = this.rows(await this.get(token, binding, "/datasets")).map(
      (r) => this.model(r),
    );
    return {
      semanticModels: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }
  async getSemanticModel(
    token: string,
    binding: MicrosoftPowerBIBinding,
    input: Record<string, unknown>,
  ) {
    const id = this.id(input.semanticModelId, "semanticModelId");
    return {
      semanticModel: this.model(
        this.object(await this.get(token, binding, `/datasets/${id}`)),
      ),
    };
  }
  private async get(
    token: string,
    binding: MicrosoftPowerBIBinding,
    suffix: string,
  ) {
    if (!token.trim())
      throw new MicrosoftPowerBIApiError(
        "microsoft_power_bi_token_invalid",
        "Power BI connection token is missing.",
      );
    const workspace = this.id(binding.workspaceId, "selectedWorkspaceId");
    const url = new URL(`/v1.0/myorg/groups/${workspace}${suffix}`, ORIGIN);
    if (
      url.origin !== ORIGIN ||
      !/^\/v1\.0\/myorg\/groups\/[A-Za-z0-9_-]{1,128}(?:\/reports|\/datasets(?:\/[A-Za-z0-9_-]{1,128})?)?$/.test(
        url.pathname,
      ) ||
      url.search ||
      /\/(users|refreshes|executeQueries|Export|gateways|datasources|pages)(\/|$)/i.test(
        url.pathname,
      )
    )
      throw new MicrosoftPowerBIApiError(
        "microsoft_power_bi_path_blocked",
        "Power BI request is outside the selected-workspace metadata V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftPowerBIApiError(
        "microsoft_power_bi_unavailable",
        "Power BI is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftPowerBIApiError(
        "microsoft_power_bi_response_too_large",
        "Power BI response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftPowerBIApiError(
        "microsoft_power_bi_response_invalid",
        "Power BI returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftPowerBIApiError(
        response.status === 401
          ? "microsoft_power_bi_token_invalid"
          : response.status === 403
            ? "microsoft_power_bi_permission_denied"
            : response.status === 404
              ? "microsoft_power_bi_not_found"
              : response.status === 429
                ? "microsoft_power_bi_rate_limited"
                : "microsoft_power_bi_api_error",
        "Power BI request failed.",
        response.status,
      );
    return body;
  }
  private rows(v: unknown) {
    const root = this.object(v);
    return Array.isArray(root.value)
      ? root.value.slice(0, 25).map((r) => this.object(r))
      : [];
  }
  private workspace(r: Record<string, unknown>) {
    return {
      id: this.scalar(r.id, 128),
      name: this.scalar(r.name),
      isReadOnly: this.scalar(r.isReadOnly),
      isOnDedicatedCapacity: this.scalar(r.isOnDedicatedCapacity),
      capacityDetailsExcluded: true,
      resourceDetailsExcluded: true,
    };
  }
  private report(r: Record<string, unknown>) {
    return {
      id: this.scalar(r.id, 128),
      name: this.scalar(r.name),
      reportType: this.scalar(r.reportType, 64),
      datasetId: this.scalar(r.datasetId, 128),
      description: this.scalar(r.description, 2000),
      embedURLExcluded: true,
      webURLExcluded: true,
      usersExcluded: true,
      ownershipExcluded: true,
    };
  }
  private model(r: Record<string, unknown>) {
    return {
      id: this.scalar(r.id, 128),
      name: this.scalar(r.name),
      isRefreshable: this.scalar(r.isRefreshable),
      isEffectiveIdentityRequired: this.scalar(r.isEffectiveIdentityRequired),
      isEffectiveIdentityRolesRequired: this.scalar(
        r.isEffectiveIdentityRolesRequired,
      ),
      isOnPremGatewayRequired: this.scalar(r.isOnPremGatewayRequired),
      configuredByExcluded: true,
      usersExcluded: true,
      urlsExcluded: true,
      queryContentExcluded: true,
    };
  }
  private id(v: unknown, field: string) {
    if (typeof v !== "string" || !SAFE_ID.test(v))
      throw new MicrosoftPowerBIApiError(
        "microsoft_power_bi_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return v;
  }
  private object(v: unknown): Record<string, unknown> {
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  }
  private scalar(v: unknown, max = 512): string | number | boolean | null {
    if (typeof v === "string") return v.slice(0, max);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "boolean") return v;
    return null;
  }
}
