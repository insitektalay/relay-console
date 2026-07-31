export type ZendeskCredentials = {
  accessToken: string;
  instanceOrigin: string;
  userId: string;
};

export class ZendeskApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class ZendeskApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: ZendeskCredentials) {
    const current = await this.request(credentials, "/api/v2/users/me.json");
    const user = this.record(current.user);
    const id = this.numericId(user.id);
    if (id !== credentials.userId)
      throw new ZendeskApiError(
        "zendesk_user_binding_mismatch",
        "Zendesk authorizing user binding changed.",
        403,
      );
    return {
      userId: id,
      userName: this.text(user.name),
      role: this.text(user.role),
    };
  }

  async ticketCount(credentials: ZendeskCredentials) {
    const body = await this.request(credentials, "/api/v2/tickets/count.json");
    const count = this.record(body.count);
    return {
      value: this.number(count.value),
      refreshedAt: this.text(count.refreshed_at),
    };
  }

  async listTickets(
    credentials: ZendeskCredentials,
    input: { limit?: number },
  ) {
    const limit = this.limit(input.limit);
    const query = new URLSearchParams({
      per_page: String(limit),
      sort_by: "updated_at",
      sort_order: "desc",
    });
    const body = await this.request(
      credentials,
      `/api/v2/tickets.json?${query.toString()}`,
    );
    return {
      tickets: this.array(body.tickets)
        .slice(0, limit)
        .map((ticket) => this.ticket(ticket)),
    };
  }

  async getTicket(
    credentials: ZendeskCredentials,
    input: { ticketId: string },
  ) {
    const ticketId = this.ticketId(input.ticketId);
    const body = await this.request(
      credentials,
      `/api/v2/tickets/${ticketId}.json`,
    );
    return { ticket: this.ticket(body.ticket) };
  }

  private async request(credentials: ZendeskCredentials, path: string) {
    const origin = this.instanceOrigin(credentials.instanceOrigin);
    const response = await this.requester(`${origin}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Zendesk/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "zendesk_token_invalid"
          : response.status === 403
            ? "zendesk_permission_denied"
            : response.status === 404
              ? "zendesk_record_not_found"
              : response.status === 429
                ? "zendesk_rate_limited"
                : "zendesk_unavailable";
      throw new ZendeskApiError(
        code,
        "Zendesk API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new ZendeskApiError(
        "zendesk_response_too_large",
        "Zendesk response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ZendeskApiError(
        "zendesk_response_invalid",
        "Zendesk returned an invalid response.",
      );
    }
  }

  private instanceOrigin(value: string) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new ZendeskApiError(
        "zendesk_instance_invalid",
        "Zendesk Support instance is invalid.",
        400,
      );
    }
    const host = url.hostname.toLowerCase();
    const label = host.endsWith(".zendesk.com")
      ? host.slice(0, -".zendesk.com".length)
      : "";
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
    )
      throw new ZendeskApiError(
        "zendesk_instance_invalid",
        "Zendesk Support instance is invalid.",
        400,
      );
    return `https://${label}.zendesk.com`;
  }

  private ticketId(value: string) {
    if (!/^[1-9][0-9]{0,19}$/.test(value))
      throw new ZendeskApiError(
        "zendesk_ticket_id_invalid",
        "Zendesk ticket ID is invalid.",
        400,
      );
    return value;
  }

  private limit(value?: number) {
    if (value === undefined) return 25;
    if (!Number.isInteger(value) || value < 1 || value > 25)
      throw new ZendeskApiError(
        "zendesk_limit_invalid",
        "Zendesk ticket limit must be between 1 and 25.",
        400,
      );
    return value;
  }

  private ticket(value: unknown) {
    const ticket = this.record(value);
    const satisfaction = this.record(ticket.satisfaction_rating);
    return {
      ticketId: this.numericId(ticket.id),
      subject: this.text(ticket.subject),
      status: this.text(ticket.status),
      priority: this.text(ticket.priority),
      type: this.text(ticket.type),
      organizationId: this.numericId(ticket.organization_id),
      groupId: this.numericId(ticket.group_id),
      brandId: this.numericId(ticket.brand_id),
      ticketFormId: this.numericId(ticket.ticket_form_id),
      dueAt: this.text(ticket.due_at),
      createdAt: this.text(ticket.created_at),
      updatedAt: this.text(ticket.updated_at),
      satisfactionScore: this.text(satisfaction.score),
    };
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private numericId(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0
      ? String(value)
      : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 512) : null;
  }
}
