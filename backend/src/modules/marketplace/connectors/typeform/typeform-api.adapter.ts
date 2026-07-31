import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type TypeformCredentials = {
  accessToken: string;
  accountId: string;
  workspaceId: string;
  apiOrigin: string;
};

export class TypeformApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class TypeformApiAdapter {
  static readonly allowedOrigins = new Set([
    "https://api.typeform.com",
    "https://api.eu.typeform.com",
    "https://api.typeform.eu",
  ]);

  private readonly lastRequests = new Map<string, number>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: TypeformCredentials) {
    this.validateCredentials(credentials);
    this.enforceRate(credentials.accountId);
    const me = this.record(
      await this.request(credentials, this.url(credentials, "/me")),
    );
    const accountId = this.accountId(me);
    if (accountId !== credentials.accountId)
      throw new TypeformApiError(
        "insufficient_scope",
        "Typeform exact-account binding changed.",
        403,
      );
    const workspacesUrl = this.url(credentials, "/workspaces");
    workspacesUrl.searchParams.set("page_size", "25");
    const workspaces = this.items(
      await this.request(credentials, workspacesUrl),
    ).map((value) => this.record(value));
    const workspace = workspaces.find(
      (value) => this.text(value.id, 64) === credentials.workspaceId,
    );
    if (!workspace)
      throw new TypeformApiError(
        "insufficient_scope",
        "Typeform selected-workspace binding changed.",
        403,
      );
    return {
      accountId,
      accountLabel:
        this.text(me.alias, 200) || this.text(me.email, 320) || null,
      workspaceId: credentials.workspaceId,
      workspaceName: this.text(workspace.name, 200) || null,
      apiOrigin: credentials.apiOrigin,
    };
  }

  async listWorkspaceForms(credentials: TypeformCredentials) {
    this.validateCredentials(credentials);
    this.enforceRate(credentials.accountId);
    const url = this.url(credentials, "/forms");
    url.searchParams.set("workspace_id", credentials.workspaceId);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "25");
    url.searchParams.set("sort_by", "last_updated_at");
    url.searchParams.set("order_by", "desc");
    return {
      forms: this.items(await this.request(credentials, url))
        .slice(0, 25)
        .map((value) => this.form(value, credentials.workspaceId)),
    };
  }

  async getFormSummary(
    credentials: TypeformCredentials,
    input: { formId: string },
  ) {
    this.validateCredentials(credentials);
    this.enforceRate(credentials.accountId);
    const formId = this.identifier(input.formId, "Form");
    return {
      form: this.form(
        await this.request(
          credentials,
          this.url(credentials, `/forms/${formId}`),
        ),
        credentials.workspaceId,
      ),
    };
  }

  async listRecentResponses(
    credentials: TypeformCredentials,
    input: { formId: string },
    now = this.now(),
  ) {
    this.validateCredentials(credentials);
    this.enforceRate(credentials.accountId);
    const formId = this.identifier(input.formId, "Form");
    const url = this.url(credentials, `/forms/${formId}/responses`);
    url.searchParams.set(
      "since",
      new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    );
    url.searchParams.set("until", now.toISOString());
    url.searchParams.set("page_size", "25");
    url.searchParams.set("response_type", "completed");
    url.searchParams.set("sort", "submitted_at,desc");
    return {
      responses: this.items(await this.request(credentials, url))
        .slice(0, 25)
        .map((value) => this.responseSummary(value)),
      providerFreshnessCaveatMinutes: 30,
    };
  }

  private url(credentials: TypeformCredentials, path: string) {
    if (
      !/^\/(?:me|workspaces|forms(?:\/[A-Za-z0-9_-]{1,64}(?:\/responses)?)?)$/.test(
        path,
      )
    )
      throw new TypeformApiError(
        "provider_validation_error",
        "Typeform API path is invalid.",
      );
    return new URL(path, credentials.apiOrigin);
  }

  private async request(credentials: TypeformCredentials, url: URL) {
    if (!credentials.accessToken.trim())
      throw new TypeformApiError(
        "credential_missing",
        "Typeform access token is required.",
        401,
      );
    if (url.origin !== credentials.apiOrigin)
      throw new TypeformApiError(
        "provider_validation_error",
        "Typeform request origin is invalid.",
      );
    return this.response(
      await this.requester(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credentials.accessToken}`,
          "User-Agent": "RelayConsole-Typeform/1.0",
        },
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new TypeformApiError(
        "provider_validation_error",
        "Typeform response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new TypeformApiError(
        "provider_validation_error",
        "Typeform response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new TypeformApiError(
        "provider_validation_error",
        "Typeform returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new TypeformApiError(
        this.safeCode(response.status),
        `Typeform returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: TypeformCredentials) {
    if (
      !credentials.accessToken.trim() ||
      !this.safeId(credentials.accountId) ||
      !this.safeId(credentials.workspaceId) ||
      !TypeformApiAdapter.allowedOrigins.has(credentials.apiOrigin)
    )
      throw new TypeformApiError(
        "credential_missing",
        "Typeform access token, account, workspace, or API-region binding is missing.",
      );
  }

  private form(value: unknown, workspaceId: string) {
    const item = this.record(value);
    const settings = this.record(item.settings);
    return {
      formId: this.idOrNull(item.id),
      title: this.text(item.title, 500) || null,
      language: this.text(item.language, 20) || null,
      isPublic: settings.is_public === true,
      createdAt: this.date(item.created_at),
      lastUpdatedAt: this.date(item.last_updated_at),
      workspaceId,
    };
  }

  private responseSummary(value: unknown) {
    const item = this.record(value);
    return {
      responseId: this.idOrNull(item.response_id),
      responseType: this.text(item.response_type, 50) || null,
      landedAt: this.date(item.landed_at),
      submittedAt: this.date(item.submitted_at),
    };
  }

  private items(value: unknown) {
    const body = this.record(value);
    return Array.isArray(body.items) ? body.items : [];
  }

  private accountId(value: JsonObject) {
    return this.identifier(
      value.id ?? value.account_id ?? value.user_id ?? value.alias,
      "Account",
    );
  }

  private enforceRate(accountId: string) {
    const current = this.now().getTime();
    const previous = this.lastRequests.get(accountId);
    if (previous !== undefined && current - previous < 500)
      throw new TypeformApiError(
        "provider_rate_limited",
        "Typeform allows at most two requests per second for this account.",
        429,
      );
    this.lastRequests.set(accountId, current);
  }

  private identifier(value: unknown, label: string) {
    const text = this.text(value, 64);
    if (!this.safeId(text))
      throw new TypeformApiError(
        "provider_validation_error",
        `An exact safe Typeform ${label} ID is required.`,
      );
    return text;
  }

  private idOrNull(value: unknown) {
    try {
      return this.identifier(value, "resource");
    } catch {
      return null;
    }
  }

  private safeId(value: string) {
    return /^[A-Za-z0-9_-]{1,64}$/.test(value);
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" ? value.trim().slice(0, maximum) : "";
  }

  private date(value: unknown) {
    const text = this.text(value, 100);
    return text && !Number.isNaN(Date.parse(text)) ? text : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
