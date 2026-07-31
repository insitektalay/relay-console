import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type BetterProposalsCredentials = { apiToken: string };

export class BetterProposalsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class BetterProposalsApiAdapter {
  private static readonly ORIGIN = "https://api.betterproposals.io";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: BetterProposalsCredentials) {
    const value = this.object(await this.get(credentials, "/proposal/count"));
    const data = this.object(value.data);
    return {
      credentialValid: true,
      proposalCount: this.number(
        data.count ?? data.Count ?? data.total ?? data.Total ?? value.data,
      ),
      providerRequestCount: 1,
      broadAccountToken: true,
      writesEnabled: false,
    };
  }

  async listProposals(credentials: BetterProposalsCredentials, input: JsonObject) {
    const resultLimit = this.resultLimit(input.resultLimit);
    const value = this.object(await this.get(credentials, "/proposal"));
    const proposals = this.dataArray(value.data)
      .slice(0, resultLimit)
      .map((entry) => this.proposalSummary(this.object(entry)));
    return {
      semanticReadContract: "better-proposals-proposal-list-v1",
      proposals,
      resultCount: proposals.length,
      maxResults: resultLimit,
      providerRequestCount: 1,
      contactsReturned: false,
      companiesReturned: false,
      pricingReturned: false,
      signaturesReturned: false,
      paymentsReturned: false,
      linksReturned: false,
      contentReturned: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  async getProposal(credentials: BetterProposalsCredentials, input: JsonObject) {
    const proposalId = this.providerId(input.proposalId);
    const value = this.object(
      await this.get(
        credentials,
        `/proposal/${encodeURIComponent(proposalId)}`,
      ),
    );
    const data = this.object(value.data);
    const proposal = this.object(
      data.proposal ?? data.Proposal ?? value.proposal ?? value.Proposal ?? data,
    );
    return {
      semanticReadContract: "better-proposals-proposal-get-v1",
      proposal: this.proposalSummary(proposal),
      providerRequestCount: 1,
      contactsReturned: false,
      companiesReturned: false,
      pricingReturned: false,
      signaturesReturned: false,
      paymentsReturned: false,
      linksReturned: false,
      contentReturned: false,
      rawProviderResponseReturned: false,
      automaticRetries: false,
    };
  }

  private async get(credentials: BetterProposalsCredentials, path: string) {
    const token = this.apiToken(credentials);
    const url = new URL(path, `${BetterProposalsApiAdapter.ORIGIN}/`);
    const allowed =
      url.pathname === "/proposal" ||
      url.pathname === "/proposal/count" ||
      /^\/proposal\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname);
    if (
      url.origin !== BetterProposalsApiAdapter.ORIGIN ||
      url.search ||
      url.hash ||
      !allowed
    )
      throw new BetterProposalsApiError(
        "policy_blocked",
        "Better Proposals request escaped Relay's fixed read-only route allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json", Bptoken: token },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new BetterProposalsApiError(
        "provider_unavailable",
        "Better Proposals could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "Better Proposals response exceeded Relay's 1 MB bound.",
      );
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Better Proposals returned invalid JSON.");
    }
    const object = this.object(value);
    if (!response.ok || object.status === "error")
      throw new BetterProposalsApiError(
        this.errorCode(response.status, this.scalar(object.message, 200)),
        "Better Proposals rejected the bounded request.",
        response.status,
      );
    if (object.status !== "success")
      throw this.validation(
        "Better Proposals returned an unexpected response envelope.",
      );
    return object;
  }

  private proposalSummary(value: JsonObject) {
    return {
      proposalId: this.scalar(
        value.id ?? value.ID ?? value.ProposalID ?? value.ProposalId,
        128,
      ),
      name: this.scalar(
        value.name ?? value.Name ?? value.title ?? value.Title,
        500,
      ),
      status: this.scalar(value.status ?? value.Status, 100),
      documentType: this.scalar(
        value.documentType ?? value.DocumentType ?? value.Type,
        200,
      ),
      currency: this.scalar(value.currency ?? value.Currency, 32),
      createdAt: this.scalar(
        value.createdAt ?? value.created_at ?? value.CreatedAt ?? value.Created,
        64,
      ),
      updatedAt: this.scalar(
        value.updatedAt ?? value.updated_at ?? value.UpdatedAt ?? value.Updated,
        64,
      ),
    };
  }

  private dataArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    const object = this.object(value);
    for (const candidate of [
      object.proposals,
      object.Proposals,
      object.items,
      object.Items,
      object.results,
      object.Results,
    ]) {
      if (Array.isArray(candidate)) return candidate;
    }
    return [];
  }

  private apiToken(credentials: BetterProposalsCredentials) {
    const token = credentials.apiToken?.trim();
    if (!token || token.length > 10_000)
      throw new BetterProposalsApiError(
        "credential_missing",
        "Better Proposals API token is missing.",
        401,
      );
    return token;
  }

  private providerId(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value))
      throw this.validation(
        "proposalId must contain only provider ID characters.",
      );
    return value;
  }

  private resultLimit(value: unknown) {
    if (value === undefined) return 50;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 50)
      throw this.validation("resultLimit must be an integer from 1 to 50.");
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown, max: number) {
    if (typeof value === "string" && value) return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value))
      return String(value).slice(0, max);
    return null;
  }

  private number(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    return null;
  }

  private errorCode(status: number, message: string | null) {
    if (status === 401 || /invalid token|malformed request/i.test(message ?? ""))
      return "credential_missing" as const;
    if (/trial expired|plan.*not supported/i.test(message ?? ""))
      return "connection_not_ready" as const;
    if (status === 403) return "insufficient_scope" as const;
    if (status === 429) return "provider_rate_limited" as const;
    if (status >= 500) return "provider_unavailable" as const;
    return "provider_validation_error" as const;
  }

  private validation(message: string) {
    return new BetterProposalsApiError("provider_validation_error", message);
  }
}
