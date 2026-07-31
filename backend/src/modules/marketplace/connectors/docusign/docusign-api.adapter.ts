import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type DocusignCredentials = {
  accessToken: string;
  accountId: string;
  baseUri: string;
};

export class DocusignApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class DocusignApiAdapter {
  private readonly exactEnvelopeReads = new Map<string, number>();

  constructor(
    private readonly requester: Requester = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async health(credentials: DocusignCredentials) {
    this.validateCredentials(credentials);
    const body = this.record(
      await this.request(
        credentials,
        new URL("https://account.docusign.com/oauth/userinfo"),
      ),
    );
    const accounts = Array.isArray(body.accounts) ? body.accounts : [];
    const selected = accounts
      .map((value) => this.record(value))
      .find(
        (value) =>
          this.text(value.account_id, 64) === credentials.accountId &&
          this.baseUri(value.base_uri) === credentials.baseUri,
      );
    if (!selected)
      throw new DocusignApiError(
        "insufficient_scope",
        "Docusign selected-account binding changed.",
        403,
      );
    return {
      userId: this.opaqueId(body.sub, "user", 100),
      userName: this.text(body.name, 200) || null,
      accountId: credentials.accountId,
      accountName: this.text(selected.account_name, 200) || null,
      baseUri: credentials.baseUri,
    };
  }

  async listRecentEnvelopes(
    credentials: DocusignCredentials,
    now = this.now(),
  ) {
    return this.listEnvelopes(credentials, false, now);
  }

  async listActionRequiredEnvelopes(
    credentials: DocusignCredentials,
    now = this.now(),
  ) {
    return this.listEnvelopes(credentials, true, now);
  }

  async getEnvelope(
    credentials: DocusignCredentials,
    input: { envelopeId: string },
  ) {
    this.validateCredentials(credentials);
    const envelopeId = this.uuid(input.envelopeId);
    this.enforcePollingGuard(credentials.accountId, envelopeId);
    const url = this.apiUrl(
      credentials,
      `/v2.1/accounts/${credentials.accountId}/envelopes/${envelopeId}`,
    );
    return {
      envelope: this.envelope(await this.request(credentials, url)),
    };
  }

  private async listEnvelopes(
    credentials: DocusignCredentials,
    actionRequired: boolean,
    now: Date,
  ) {
    this.validateCredentials(credentials);
    const url = this.apiUrl(
      credentials,
      `/v2.1/accounts/${credentials.accountId}/envelopes`,
    );
    url.searchParams.set(
      "from_date",
      new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    );
    url.searchParams.set("count", "25");
    url.searchParams.set("order_by", "last_modified");
    url.searchParams.set("order", "desc");
    if (actionRequired)
      url.searchParams.set("folder_ids", "awaiting_my_signature");
    const body = this.record(await this.request(credentials, url));
    return {
      envelopes: (Array.isArray(body.envelopes) ? body.envelopes : [])
        .slice(0, 25)
        .map((value) => this.envelope(value)),
    };
  }

  private apiUrl(credentials: DocusignCredentials, path: string) {
    if (
      !/^\/v2\.1\/accounts\/[0-9A-Fa-f-]{1,64}\/envelopes(?:\/[0-9A-Fa-f-]{36})?$/.test(
        path,
      )
    )
      throw new DocusignApiError(
        "provider_validation_error",
        "Docusign API path is invalid.",
      );
    return new URL(`/restapi${path}`, credentials.baseUri);
  }

  private async request(credentials: DocusignCredentials, url: URL) {
    if (!credentials.accessToken.trim())
      throw new DocusignApiError(
        "credential_missing",
        "Docusign access token is required.",
        401,
      );
    const isUserInfo =
      url.origin === "https://account.docusign.com" &&
      url.pathname === "/oauth/userinfo";
    if (!isUserInfo && url.origin !== credentials.baseUri)
      throw new DocusignApiError(
        "provider_validation_error",
        "Docusign request origin is invalid.",
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
          "User-Agent": "RelayConsole-Docusign/1.0",
        },
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new DocusignApiError(
        "provider_validation_error",
        "Docusign response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new DocusignApiError(
        "provider_validation_error",
        "Docusign response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new DocusignApiError(
        "provider_validation_error",
        "Docusign returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new DocusignApiError(
        this.safeCode(response.status),
        `Docusign returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: DocusignCredentials) {
    if (
      !credentials.accessToken.trim() ||
      !this.accountId(credentials.accountId) ||
      this.baseUri(credentials.baseUri) !== credentials.baseUri
    )
      throw new DocusignApiError(
        "credential_missing",
        "Docusign access token, account, or regional base URI is missing.",
      );
  }

  private baseUri(value: unknown) {
    const text = this.text(value, 300);
    if (!text) return "";
    try {
      const url = new URL(text);
      const labels = url.hostname.toLowerCase().split(".");
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        (url.pathname !== "/" && url.pathname !== "") ||
        url.search ||
        url.hash ||
        labels.length !== 3 ||
        labels[1] !== "docusign" ||
        labels[2] !== "net" ||
        !/^[a-z0-9-]+$/.test(labels[0])
      )
        return "";
      return url.origin;
    } catch {
      return "";
    }
  }

  private envelope(value: unknown) {
    const item = this.record(value);
    return {
      envelopeId: this.uuidOrNull(item.envelopeId),
      emailSubject: this.text(item.emailSubject, 500) || null,
      status: this.text(item.status, 100) || null,
      createdAt: this.date(item.createdDateTime),
      sentAt: this.date(item.sentDateTime),
      completedAt: this.date(item.completedDateTime),
      statusChangedAt: this.date(item.statusChangedDateTime),
      lastModifiedAt: this.date(item.lastModifiedDateTime),
    };
  }

  private enforcePollingGuard(accountId: string, envelopeId: string) {
    const current = this.now().getTime();
    for (const [key, readAt] of this.exactEnvelopeReads)
      if (current - readAt >= 15 * 60 * 1000)
        this.exactEnvelopeReads.delete(key);
    const key = `${accountId}:${envelopeId}`;
    const previous = this.exactEnvelopeReads.get(key);
    if (previous !== undefined && current - previous < 15 * 60 * 1000)
      throw new DocusignApiError(
        "provider_rate_limited",
        "Docusign forbids repeating an exact Envelope request within fifteen minutes.",
        429,
      );
    this.exactEnvelopeReads.set(key, current);
  }

  private uuid(value: unknown) {
    const text = this.text(value, 36).toLowerCase();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        text,
      )
    )
      throw new DocusignApiError(
        "provider_validation_error",
        "An exact Docusign Envelope UUID is required.",
      );
    return text;
  }

  private uuidOrNull(value: unknown) {
    try {
      return this.uuid(value);
    } catch {
      return null;
    }
  }

  private accountId(value: unknown) {
    return /^[0-9A-Fa-f-]{1,64}$/.test(this.text(value, 64));
  }

  private opaqueId(value: unknown, label: string, maximum: number) {
    const text = this.text(value, maximum);
    if (!text || !/^[A-Za-z0-9_-]+$/.test(text))
      throw new DocusignApiError(
        "provider_validation_error",
        `Docusign ${label} identifier is invalid.`,
      );
    return text;
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
