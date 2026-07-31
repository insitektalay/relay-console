import { Injectable } from "@nestjs/common";

export class MicrosoftDynamics365ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export type MicrosoftDynamics365Binding = { environmentOrigin: string };
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SAFE_HOST =
  /^(?:[a-z0-9-]{1,63}\.)+(?:api\.crm\.dynamics\.com|api\.crm\.dynamics\.cn|api\.crm\.microsoftdynamics\.us|api\.crm9\.dynamics\.com)$/;
const ORGANIZATION_SELECT =
  "organizationid,friendlyname,uniquename,version,languagecode";
const ACCOUNT_SELECT =
  "accountid,name,accountnumber,industrycode,revenue,statecode,statuscode,createdon,modifiedon";
const OPPORTUNITY_SELECT =
  "opportunityid,name,estimatedvalue,estimatedclosedate,closeprobability,salesstagecode,statecode,statuscode,createdon,modifiedon";

@Injectable()
export class MicrosoftDynamics365ApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(token: string, binding: MicrosoftDynamics365Binding) {
    const value = await this.getOrganization(token, binding);
    return { reachable: true, organizationId: value.organization.id };
  }

  async getOrganization(token: string, binding: MicrosoftDynamics365Binding) {
    const rows = this.rows(
      await this.get(token, binding, "/organizations", {
        $select: ORGANIZATION_SELECT,
        $top: "1",
      }),
    );
    if (!rows.length)
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_not_found",
        "The selected Dynamics organization was not found.",
        404,
      );
    return { organization: this.organization(rows[0]) };
  }

  async listAccounts(token: string, binding: MicrosoftDynamics365Binding) {
    const rows = this.rows(
      await this.get(token, binding, "/accounts", {
        $select: ACCOUNT_SELECT,
        $top: "25",
        $orderby: "modifiedon desc",
      }),
    ).map((row) => this.account(row));
    return {
      accounts: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }

  async getAccount(
    token: string,
    binding: MicrosoftDynamics365Binding,
    input: Record<string, unknown>,
  ) {
    const id = this.id(input.accountId, "accountId");
    return {
      account: this.account(
        this.object(
          await this.get(token, binding, `/accounts(${id})`, {
            $select: ACCOUNT_SELECT,
          }),
        ),
      ),
    };
  }

  async listOpportunities(token: string, binding: MicrosoftDynamics365Binding) {
    const rows = this.rows(
      await this.get(token, binding, "/opportunities", {
        $select: OPPORTUNITY_SELECT,
        $top: "25",
        $orderby: "modifiedon desc",
      }),
    ).map((row) => this.opportunity(row));
    return {
      opportunities: rows,
      resultCount: rows.length,
      nextPageFollowed: false,
    };
  }

  normalizeEnvironmentOrigin(value: unknown) {
    if (typeof value !== "string") return this.invalidEnvironment();
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      return this.invalidEnvironment();
    }
    if (
      url.protocol !== "https:" ||
      !SAFE_HOST.test(url.hostname.toLowerCase()) ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      return this.invalidEnvironment();
    return `https://${url.hostname.toLowerCase()}`;
  }

  private invalidEnvironment(): never {
    throw new MicrosoftDynamics365ApiError(
      "microsoft_dynamics_365_environment_invalid",
      "A verified Microsoft Dataverse environment origin is required.",
    );
  }

  private async get(
    token: string,
    binding: MicrosoftDynamics365Binding,
    path: string,
    query: Record<string, string>,
  ) {
    if (!token.trim())
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_token_invalid",
        "Dynamics 365 connection token is missing.",
      );
    const origin = this.normalizeEnvironmentOrigin(binding.environmentOrigin);
    const url = new URL(`/api/data/v9.2${path}`, origin);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    if (
      url.origin !== origin ||
      !/^\/api\/data\/v9\.2\/(?:organizations|accounts(?:\([A-Za-z0-9_-]{1,128}\))?|opportunities)$/.test(
        url.pathname,
      ) ||
      [...url.searchParams.keys()].some(
        (key) => !["$select", "$top", "$orderby"].includes(key),
      ) ||
      /(?:\$expand|fetchxml|\$filter|\$skiptoken|\$apply|sql)/i.test(
        url.toString(),
      )
    )
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_path_blocked",
        "Dynamics 365 request is outside the selected-environment fixed-GET V1 allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_unavailable",
        "Dynamics 365 is temporarily unavailable.",
      );
    }
    const raw = await response.text();
    if (raw.length > 1_000_000)
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_response_too_large",
        "Dynamics 365 response exceeded 1 MB.",
      );
    let body: unknown = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_response_invalid",
        "Dynamics 365 returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new MicrosoftDynamics365ApiError(
        response.status === 401
          ? "microsoft_dynamics_365_token_invalid"
          : response.status === 403
            ? "microsoft_dynamics_365_permission_denied"
            : response.status === 404
              ? "microsoft_dynamics_365_not_found"
              : response.status === 429
                ? "microsoft_dynamics_365_rate_limited"
                : "microsoft_dynamics_365_api_error",
        "Dynamics 365 request failed.",
        response.status,
      );
    return body;
  }

  private rows(value: unknown) {
    const root = this.object(value);
    return Array.isArray(root.value)
      ? root.value.slice(0, 25).map((row) => this.object(row))
      : [];
  }

  private organization(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.organizationid, 128),
      friendlyName: this.scalar(row.friendlyname),
      uniqueName: this.scalar(row.uniquename),
      version: this.scalar(row.version, 64),
      languageCode: this.scalar(row.languagecode),
      identityFieldsExcluded: true,
      schemaExcluded: true,
    };
  }

  private account(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.accountid, 128),
      name: this.scalar(row.name),
      accountNumber: this.scalar(row.accountnumber, 64),
      industryCode: this.scalar(row.industrycode),
      revenue: this.scalar(row.revenue),
      stateCode: this.scalar(row.statecode),
      statusCode: this.scalar(row.statuscode),
      createdOn: this.scalar(row.createdon, 64),
      modifiedOn: this.scalar(row.modifiedon, 64),
      contactsExcluded: true,
      addressesExcluded: true,
      ownersExcluded: true,
      notesExcluded: true,
    };
  }

  private opportunity(row: Record<string, unknown>) {
    return {
      id: this.scalar(row.opportunityid, 128),
      name: this.scalar(row.name),
      estimatedValue: this.scalar(row.estimatedvalue),
      estimatedCloseDate: this.scalar(row.estimatedclosedate, 64),
      closeProbability: this.scalar(row.closeprobability),
      salesStageCode: this.scalar(row.salesstagecode),
      stateCode: this.scalar(row.statecode),
      statusCode: this.scalar(row.statuscode),
      createdOn: this.scalar(row.createdon, 64),
      modifiedOn: this.scalar(row.modifiedon, 64),
      customerLookupExcluded: true,
      ownerExcluded: true,
      descriptionNotesExcluded: true,
    };
  }

  private id(value: unknown, field: string) {
    if (typeof value !== "string" || !SAFE_ID.test(value))
      throw new MicrosoftDynamics365ApiError(
        "microsoft_dynamics_365_input_invalid",
        `A safe explicit ${field} is required.`,
      );
    return value;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private scalar(value: unknown, max = 512): string | number | boolean | null {
    if (typeof value === "string") return value.slice(0, max);
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
    return null;
  }
}
