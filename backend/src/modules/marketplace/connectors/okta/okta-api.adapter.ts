export const OKTA_SCOPE = "okta.apps.read";

export type OktaCredentials = {
  origin: string;
  clientId: string;
  clientSecret: string;
  applicationId: string;
};

export class OktaApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class OktaApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: OktaCredentials) {
    const token = await this.accessToken(credentials);
    const application = this.application(
      await this.request(
        credentials,
        token,
        `/api/v1/apps/${this.id(credentials.applicationId)}`,
      ),
    );
    if (application.id !== credentials.applicationId)
      throw new OktaApiError(
        "okta_application_binding_mismatch",
        "Okta selected Application binding changed.",
        403,
      );
    return { ready: true, applicationId: application.id };
  }

  async listApplications(
    credentials: OktaCredentials,
    input: { limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const token = await this.accessToken(credentials);
    const root = await this.request(
      credentials,
      token,
      `/api/v1/apps?limit=${Math.max(20, limit)}`,
    );
    const applications = this.array(root)
      .slice(0, limit)
      .map((value) => this.application(value));
    return {
      applications,
      returnedCount: applications.length,
      automaticPagination: false,
    };
  }

  async getApplication(credentials: OktaCredentials) {
    const applicationId = this.id(credentials.applicationId);
    const token = await this.accessToken(credentials);
    const application = this.application(
      await this.request(credentials, token, `/api/v1/apps/${applicationId}`),
    );
    if (application.id !== applicationId)
      throw new OktaApiError(
        "okta_application_binding_mismatch",
        "Okta selected Application binding changed.",
        403,
      );
    return { application };
  }

  async listApplicationGroups(
    credentials: OktaCredentials,
    input: { limit?: unknown },
  ) {
    const applicationId = this.id(credentials.applicationId);
    const limit = this.limit(input.limit);
    const token = await this.accessToken(credentials);
    const root = await this.request(
      credentials,
      token,
      `/api/v1/apps/${applicationId}/groups?limit=${Math.max(20, limit)}`,
    );
    const groups = this.array(root)
      .slice(0, limit)
      .map((value) => this.group(value));
    return { groups, returnedCount: groups.length, automaticPagination: false };
  }

  private async accessToken(credentials: OktaCredentials) {
    const origin = this.origin(credentials.origin);
    if (
      !credentials.clientId ||
      !credentials.clientSecret ||
      credentials.clientId.length > 256 ||
      credentials.clientSecret.length > 30_000
    )
      throw new OktaApiError(
        "okta_credentials_invalid",
        "Okta OIN API service credentials are missing or invalid.",
        401,
      );
    const response = await this.requester(`${origin}/oauth2/v1/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "RelayConsole-Okta/1.0",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: OKTA_SCOPE,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const root = await this.response(response, "token");
    const record = this.record(root);
    if (
      typeof record.access_token !== "string" ||
      !record.access_token ||
      record.scope !== OKTA_SCOPE ||
      record.token_type !== "Bearer" ||
      record.expires_in !== 3600
    )
      throw new OktaApiError(
        "okta_token_contract_invalid",
        "Okta did not return the exact one-hour scoped bearer token.",
        403,
      );
    return record.access_token;
  }

  private async request(
    credentials: OktaCredentials,
    token: string,
    path: string,
  ) {
    if (
      !/^\/api\/v1\/apps(?:\?limit=(?:20|21|22|23|24|25)|\/[A-Za-z0-9_-]{3,128}(?:\/groups\?limit=(?:20|21|22|23|24|25))?)$/.test(
        path,
      )
    )
      throw new OktaApiError(
        "okta_path_invalid",
        "Okta API path is invalid.",
        400,
      );
    const response = await this.requester(
      `${this.origin(credentials.origin)}${path}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-Okta/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    return this.response(response, "api");
  }

  private async response(response: Response, surface: "token" | "api") {
    if (!response.ok) {
      const code =
        response.status === 401
          ? "okta_credentials_invalid"
          : response.status === 403
            ? "okta_scope_denied"
            : response.status === 404
              ? "okta_resource_not_found"
              : response.status === 429
                ? "okta_rate_limited"
                : `okta_${surface}_unavailable`;
      throw new OktaApiError(
        code,
        `Okta ${surface} request failed.`,
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new OktaApiError(
        "okta_response_too_large",
        "Okta response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new OktaApiError(
        "okta_response_invalid",
        "Okta returned an invalid response.",
      );
    }
  }

  private application(value: unknown) {
    const app = this.record(value);
    const accessibility = this.record(app.accessibility);
    const visibility = this.record(app.visibility);
    return {
      id: this.id(app.id),
      name: this.text(app.name),
      label: this.text(app.label),
      status: this.text(app.status),
      signOnMode: this.text(app.signOnMode),
      createdAt: this.text(app.created),
      updatedAt: this.text(app.lastUpdated),
      selfService: this.boolean(accessibility.selfService),
      hidden: this.boolean(visibility.hide),
      features: this.array(app.features)
        .filter((item): item is string => typeof item === "string")
        .slice(0, 25)
        .map((item) => item.slice(0, 120)),
      credentialsReturned: false,
      settingsReturned: false,
      userAssignmentsReturned: false,
    };
  }

  private group(value: unknown) {
    const group = this.record(value);
    const profile = this.record(group.profile);
    return {
      id: this.id(group.id),
      type: this.text(group.type),
      name: this.text(profile.name),
      description: this.text(profile.description),
      createdAt: this.text(group.created),
      updatedAt: this.text(group.lastUpdated),
      membershipRulePresent: group._embedded !== undefined,
      membersReturned: false,
    };
  }

  private origin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new OktaApiError(
        "okta_origin_invalid",
        "Okta Org origin is invalid.",
        400,
      );
    }
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      ![".okta.com", ".okta-emea.com", ".oktapreview.com"].some(
        (suffix) => host.endsWith(suffix) && host.length > suffix.length,
      )
    )
      throw new OktaApiError(
        "okta_origin_invalid",
        "Okta Org origin is invalid.",
        400,
      );
    return `https://${host}`;
  }

  private id(value: unknown) {
    const text = this.text(value);
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(text))
      throw new OktaApiError(
        "okta_id_invalid",
        "Okta identifier is invalid.",
        400,
      );
    return text;
  }

  private limit(value: unknown) {
    const limit = value === undefined ? 25 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new OktaApiError(
        "okta_limit_invalid",
        "Okta limit must be 1 through 25.",
        400,
      );
    return limit;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_200) : "";
  }
  private boolean(value: unknown) {
    return typeof value === "boolean" ? value : false;
  }
}
