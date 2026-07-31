import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type SendFoxCredentials = { accessToken: string; accountId: string };

export class SendFoxApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class SendFoxApiAdapter {
  static readonly apiOrigin = "https://api.sendfox.com";
  private readonly lastRequests = new Map<string, number>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: SendFoxCredentials) {
    const me = this.record(await this.get(credentials, "/me"));
    const accountId = this.id(me.id, "Account");
    if (accountId !== credentials.accountId)
      throw new SendFoxApiError(
        "insufficient_scope",
        "SendFox exact-account binding changed.",
        403,
      );
    return {
      accountId,
      accountLabel:
        this.text(me.name, 200) || `SendFox account …${accountId.slice(-8)}`,
      apiOrigin: SendFoxApiAdapter.apiOrigin,
    };
  }

  async getAccountSummary(credentials: SendFoxCredentials) {
    const me = this.record(await this.get(credentials, "/me"));
    const accountId = this.id(me.id, "Account");
    this.assertAccount(credentials, accountId);
    return {
      account: {
        accountId,
        contactsCount: this.nonnegative(me.contacts_count),
        contactLimit: this.nonnegative(me.contact_limit),
        createdAt: this.date(me.created_at),
      },
    };
  }

  async listContactLists(credentials: SendFoxCredentials) {
    const value = this.record(
      await this.get(credentials, "/lists", { page: "1" }),
    );
    return {
      lists: this.items(value)
        .slice(0, 25)
        .map((entry) => this.listSummary(entry, credentials.accountId)),
    };
  }

  async listCampaigns(credentials: SendFoxCredentials) {
    const value = this.record(
      await this.get(credentials, "/campaigns", { page: "1" }),
    );
    return {
      campaigns: this.items(value)
        .slice(0, 25)
        .map((entry) => this.campaignSummary(entry)),
    };
  }

  private async get(
    credentials: SendFoxCredentials,
    path: "/me" | "/lists" | "/campaigns",
    query: Record<string, string> = {},
  ) {
    this.validateCredentials(credentials);
    this.enforceRate(credentials.accountId);
    const url = new URL(path, SendFoxApiAdapter.apiOrigin);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const response = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-SendFox/1.0",
      },
    });
    return this.response(response);
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw this.validation(
        "SendFox response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw this.validation(
        "SendFox response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw this.validation("SendFox returned invalid JSON.", response.status);
    }
    if (!response.ok)
      throw new SendFoxApiError(
        this.safeCode(response.status),
        response.status === 402
          ? "SendFox API access requires a paid account plan."
          : `SendFox returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private listSummary(value: unknown, accountId: string) {
    const item = this.record(value);
    const userId = this.id(item.user_id, "List owner");
    this.assertAccount({ accessToken: "present", accountId }, userId);
    return {
      listId: this.id(item.id, "List"),
      name: this.text(item.name, 191) || null,
      averageOpenPercent: this.percent(item.average_email_open_percent),
      averageClickPercent: this.percent(item.average_email_click_percent),
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private campaignSummary(value: unknown) {
    const item = this.record(value);
    return {
      campaignId: this.id(item.id, "Campaign"),
      state: item.sent_at ? "sent" : item.scheduled_at ? "scheduled" : "draft",
      scheduledAt: this.date(item.scheduled_at),
      sentAt: this.date(item.sent_at),
      createdAt: this.date(item.created_at),
      updatedAt: this.date(item.updated_at),
    };
  }

  private validateCredentials(credentials: SendFoxCredentials) {
    if (
      !credentials.accessToken.trim() ||
      !/^[1-9][0-9]{0,18}$/.test(credentials.accountId)
    )
      throw new SendFoxApiError(
        "credential_missing",
        "SendFox access token or exact-account binding is missing.",
      );
  }

  private assertAccount(credentials: SendFoxCredentials, actual: string) {
    if (actual !== credentials.accountId)
      throw new SendFoxApiError(
        "insufficient_scope",
        "SendFox resource owner does not match the connected account.",
        403,
      );
  }

  private enforceRate(accountId: string) {
    const current = this.now().getTime();
    const previous = this.lastRequests.get(accountId);
    if (previous !== undefined && current - previous < 1_000)
      throw new SendFoxApiError(
        "provider_rate_limited",
        "SendFox allows at most sixty requests per minute for this account.",
        429,
      );
    this.lastRequests.set(accountId, current);
  }

  private items(value: JsonObject) {
    return Array.isArray(value.data) ? value.data : [];
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private id(value: unknown, label: string) {
    const text = String(value ?? "");
    if (!/^[1-9][0-9]{0,18}$/.test(text))
      throw this.validation(`${label} identifier is invalid.`);
    return text;
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
  }

  private nonnegative(value: unknown) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
  }

  private percent(value: unknown) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100
      ? number
      : null;
  }

  private date(value: unknown) {
    if (typeof value !== "string" || Number.isNaN(Date.parse(value)))
      return null;
    return new Date(value).toISOString();
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 402 || status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string, statusCode?: number) {
    return new SendFoxApiError(
      "provider_validation_error",
      message,
      statusCode,
    );
  }
}
