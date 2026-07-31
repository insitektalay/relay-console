export const GMAIL_API_ORIGIN = "https://gmail.googleapis.com/gmail/v1";
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
];
export type GmailCredentials = { accessToken: string; accountEmail: string };
export class GmailApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}
type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class GmailApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}
  async health(credentials: GmailCredentials) {
    const profile = this.record(
      await this.request(credentials, "/users/me/profile", "GET"),
    );
    const emailAddress = this.email(profile.emailAddress);
    if (
      emailAddress.toLowerCase() !==
      this.email(credentials.accountEmail).toLowerCase()
    )
      throw new GmailApiError(
        "gmail_account_binding_mismatch",
        "Gmail account binding changed.",
        403,
      );
    return { ready: true, accountEmail: emailAddress };
  }
  async searchMessages(
    credentials: GmailCredentials,
    input: { query?: unknown; limit?: unknown },
  ) {
    const query = this.requiredText(input.query, 500, "query");
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/users/me/messages?maxResults=${limit}&q=${encodeURIComponent(query)}`,
        "GET",
      ),
    );
    const ids = this.array(root.messages)
      .slice(0, limit)
      .map((v) => this.id(this.record(v).id));
    const messages = await Promise.all(
      ids.map(async (id) =>
        this.message(
          await this.request(
            credentials,
            `/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            "GET",
          ),
          false,
        ),
      ),
    );
    return {
      messages,
      limit,
      automaticPagination: false,
      attachmentsReturned: false,
    };
  }
  async getMessage(
    credentials: GmailCredentials,
    input: { messageId?: unknown },
  ) {
    const id = this.id(input.messageId);
    return {
      message: this.message(
        await this.request(
          credentials,
          `/users/me/messages/${id}?format=full`,
          "GET",
        ),
        true,
      ),
      attachmentsReturned: false,
    };
  }
  async listLabels(credentials: GmailCredentials) {
    const root = this.record(
      await this.request(credentials, "/users/me/labels", "GET"),
    );
    return {
      labels: this.array(root.labels)
        .slice(0, 100)
        .map((v) => {
          const label = this.record(v);
          return {
            id: this.text(label.id, 200),
            name: this.text(label.name, 500),
            type: this.text(label.type, 100),
          };
        }),
      automaticPagination: false,
    };
  }
  async createDraft(
    credentials: GmailCredentials,
    input: Record<string, unknown>,
  ) {
    const raw = this.mime(input);
    const root = this.record(
      await this.request(credentials, "/users/me/drafts", "POST", {
        message: { raw },
      }),
    );
    const message = this.record(root.message);
    return {
      draft: {
        id: this.text(root.id, 200),
        messageId: this.text(message.id, 200),
        threadId: this.text(message.threadId, 200),
      },
      sent: false,
    };
  }
  async sendMessage(
    credentials: GmailCredentials,
    input: Record<string, unknown>,
  ) {
    const raw = this.mime(input);
    const root = this.record(
      await this.request(credentials, "/users/me/messages/send", "POST", {
        raw,
      }),
    );
    return {
      message: {
        id: this.text(root.id, 200),
        threadId: this.text(root.threadId, 200),
        labelIds: this.array(root.labelIds)
          .slice(0, 20)
          .map((v) => this.text(v, 200)),
      },
      sent: true,
    };
  }
  private async request(
    credentials: GmailCredentials,
    path: string,
    method: "GET" | "POST",
    body?: unknown,
  ) {
    if (
      !/^\/users\/me\/(?:profile|labels|messages(?:\?maxResults=(?:[1-9]|1[0-9]|2[0-5])&q=.{1,1500}|\/[A-Za-z0-9_-]{1,200}\?format=(?:full|metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date)|\/send)|drafts)$/.test(
        path,
      )
    )
      throw new GmailApiError(
        "gmail_path_invalid",
        "Gmail API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new GmailApiError(
        "gmail_credential_missing",
        "Gmail OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${GMAIL_API_ORIGIN}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        "User-Agent": "RelayConsole-Gmail/1.0",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "gmail_token_invalid"
          : response.status === 403
            ? "gmail_scope_or_policy_denied"
            : response.status === 404
              ? "gmail_resource_not_found"
              : response.status === 429
                ? "gmail_rate_limited"
                : "gmail_unavailable";
      throw new GmailApiError(
        code,
        "Gmail API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new GmailApiError(
        "gmail_response_too_large",
        "Gmail response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new GmailApiError(
        "gmail_response_invalid",
        "Gmail returned an invalid response.",
      );
    }
  }
  private message(value: unknown, includeBody: boolean) {
    const message = this.record(value);
    const payload = this.record(message.payload);
    const headers = new Map(
      this.array(payload.headers).map((v) => {
        const h = this.record(v);
        return [
          this.text(h.name, 100).toLowerCase(),
          this.text(h.value, 1200),
        ] as const;
      }),
    );
    return {
      id: this.id(message.id),
      threadId: this.text(message.threadId, 200),
      from: headers.get("from") ?? "",
      subject: headers.get("subject") ?? "",
      date: headers.get("date") ?? "",
      snippet: this.text(message.snippet, 1200),
      bodyExcerpt: includeBody ? this.body(payload).slice(0, 12_000) : "",
      labelIds: this.array(message.labelIds)
        .slice(0, 25)
        .map((v) => this.text(v, 200)),
      attachmentsReturned: false,
    };
  }
  private body(part: Record<string, unknown>): string {
    const mime = this.text(part.mimeType, 100);
    const data = this.text(this.record(part.body).data, 50_000);
    if (mime === "text/plain" && data) {
      try {
        return Buffer.from(
          data.replace(/-/g, "+").replace(/_/g, "/"),
          "base64",
        ).toString("utf8");
      } catch {
        return "";
      }
    }
    for (const child of this.array(part.parts)) {
      const found = this.body(this.record(child));
      if (found) return found;
    }
    return "";
  }
  private mime(input: Record<string, unknown>) {
    const to = this.array(input.to).map((v) => this.email(v));
    if (!to.length || to.length > 20)
      throw new GmailApiError(
        "gmail_recipients_invalid",
        "Gmail requires 1 through 20 recipients.",
        400,
      );
    const subject = this.requiredText(input.subject, 500, "subject");
    const body = this.requiredText(input.body, 20_000, "body");
    const clean = (v: string) => v.replace(/[\r\n]/g, " ");
    const raw = `To: ${to.map(clean).join(", ")}\r\nSubject: ${clean(subject)}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`;
    return Buffer.from(raw, "utf8").toString("base64url");
  }
  private email(value: unknown) {
    const text = this.text(value, 320);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      throw new GmailApiError(
        "gmail_email_invalid",
        "Gmail email address is invalid.",
        400,
      );
    return text;
  }
  private id(value: unknown) {
    const text = this.text(value, 200);
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(text))
      throw new GmailApiError(
        "gmail_message_id_invalid",
        "Gmail message ID is invalid.",
        400,
      );
    return text;
  }
  private limit(value: unknown) {
    const limit = value === undefined ? 10 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new GmailApiError(
        "gmail_limit_invalid",
        "Gmail limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }
  private requiredText(value: unknown, max: number, name: string) {
    const text = this.text(value, max + 1).trim();
    if (!text || text.length > max)
      throw new GmailApiError(
        `gmail_${name}_invalid`,
        `Gmail ${name} is invalid.`,
        400,
      );
    return text;
  }
  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }
}
