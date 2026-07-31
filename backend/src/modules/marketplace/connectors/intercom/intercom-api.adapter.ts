export type IntercomApiCredentials = {
  accessToken: string;
  apiOrigin: string;
  workspaceId: string;
  adminId: string;
  region: string;
};

export class IntercomApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class IntercomApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: IntercomApiCredentials) {
    const me = await this.request(credentials, "/me");
    const app = this.record(me.app);
    const adminId = this.id(me.id);
    const workspaceId = this.text(app.id_code);
    const region = this.region(app.region);
    if (
      adminId !== credentials.adminId ||
      workspaceId !== credentials.workspaceId ||
      region !== credentials.region ||
      me.email_verified !== true
    )
      throw new IntercomApiError(
        "intercom_authority_mismatch",
        "Intercom workspace, region, or verified admin binding changed.",
        403,
      );
    return {
      workspaceId,
      workspaceName: this.text(app.name),
      adminId,
      region,
      emailVerified: true,
    };
  }

  async conversationCount(credentials: IntercomApiCredentials) {
    const body = await this.request(credentials, "/conversations?per_page=1");
    return { totalCount: this.number(body.total_count) };
  }

  async listConversations(
    credentials: IntercomApiCredentials,
    input: { limit?: number },
  ) {
    const limit = this.limit(input.limit);
    const body = await this.request(
      credentials,
      `/conversations?per_page=${limit}`,
    );
    return {
      totalCount: this.number(body.total_count),
      conversations: this.array(body.conversations)
        .slice(0, limit)
        .map((conversation) => this.conversation(conversation)),
    };
  }

  async getConversation(
    credentials: IntercomApiCredentials,
    input: { conversationId: string },
  ) {
    const conversationId = this.conversationId(input.conversationId);
    const body = await this.request(
      credentials,
      `/conversations/${conversationId}`,
    );
    return { conversation: this.conversation(body) };
  }

  private async request(credentials: IntercomApiCredentials, path: string) {
    const origin = this.apiOrigin(credentials.apiOrigin, credentials.region);
    const response = await this.requester(`${origin}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "Intercom-Version": "2.15",
        "User-Agent": "RelayConsole-Intercom/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "intercom_token_invalid"
          : response.status === 403
            ? "intercom_permission_denied"
            : response.status === 404
              ? "intercom_record_not_found"
              : response.status === 429
                ? "intercom_rate_limited"
                : "intercom_unavailable";
      throw new IntercomApiError(
        code,
        "Intercom API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new IntercomApiError(
        "intercom_response_too_large",
        "Intercom response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new IntercomApiError(
        "intercom_response_invalid",
        "Intercom returned an invalid response.",
      );
    }
  }

  private conversation(value: unknown) {
    const conversation = this.record(value);
    return {
      conversationId: this.id(conversation.id),
      state: this.text(conversation.state),
      priority: conversation.priority === true,
      read: conversation.read === true,
      createdAt: this.number(conversation.created_at),
      updatedAt: this.number(conversation.updated_at),
      waitingSince: this.number(conversation.waiting_since),
      snoozedUntil: this.number(conversation.snoozed_until),
      open: conversation.open === true,
    };
  }

  private apiOrigin(value: string, regionValue: string) {
    const region = this.region(regionValue);
    const expected =
      region === "EU"
        ? "https://api.eu.intercom.io"
        : region === "AU"
          ? "https://api.au.intercom.io"
          : "https://api.intercom.io";
    if (value !== expected)
      throw new IntercomApiError(
        "intercom_region_invalid",
        "Intercom API region is invalid.",
        400,
      );
    return expected;
  }

  private region(value: unknown) {
    const region = typeof value === "string" ? value.toUpperCase() : "";
    if (!["US", "EU", "AU"].includes(region))
      throw new IntercomApiError(
        "intercom_region_invalid",
        "Intercom workspace region is invalid.",
        400,
      );
    return region;
  }

  private conversationId(value: string) {
    if (!/^[1-9][0-9]{0,19}$/.test(value))
      throw new IntercomApiError(
        "intercom_conversation_id_invalid",
        "Intercom conversation ID is invalid.",
        400,
      );
    return value;
  }

  private limit(value?: number) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || value < 1 || value > 25)
      throw new IntercomApiError(
        "intercom_limit_invalid",
        "Intercom conversation limit must be between 1 and 25.",
        400,
      );
    return value;
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private id(value: unknown) {
    const text = this.text(value);
    return text && /^[A-Za-z0-9_-]{1,200}$/.test(text) ? text : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 512) : null;
  }
}
