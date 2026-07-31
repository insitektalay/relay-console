import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type DropboxSignCredentials = {
  accessToken: string;
  accountId: string;
};

export class DropboxSignApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class DropboxSignApiAdapter {
  private readonly apiOrigin = "https://api.hellosign.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: DropboxSignCredentials) {
    this.validateCredentials(credentials);
    const url = this.url("/v3/account");
    url.searchParams.set("account_id", credentials.accountId);
    const body = this.record(await this.request(credentials, url));
    const account = this.record(body.account);
    const accountId = this.identifier(account.account_id, "account");
    if (accountId !== credentials.accountId)
      throw new DropboxSignApiError(
        "insufficient_scope",
        "Dropbox Sign exact-account binding changed.",
        403,
      );
    return {
      accountId,
      accountLabel: this.text(account.email_address, 320) || null,
      locale: this.locale(account.locale),
      locked: account.is_locked === true,
      paid: account.is_paid_hs === true,
      apiOrigin: `${this.apiOrigin}/v3`,
    };
  }

  async listSignatureRequests(credentials: DropboxSignCredentials) {
    return this.list(credentials, false);
  }

  async listAwaitingSignatureRequests(credentials: DropboxSignCredentials) {
    return this.list(credentials, true);
  }

  async getSignatureRequest(
    credentials: DropboxSignCredentials,
    input: { signatureRequestId: string },
  ) {
    this.validateCredentials(credentials);
    const id = this.identifier(input.signatureRequestId, "signature request");
    const body = this.record(
      await this.request(credentials, this.url(`/v3/signature_request/${id}`)),
    );
    return {
      signatureRequest: this.signatureRequest(body.signature_request ?? body),
    };
  }

  private async list(credentials: DropboxSignCredentials, awaiting: boolean) {
    this.validateCredentials(credentials);
    const url = this.url("/v3/signature_request/list");
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "25");
    if (awaiting) url.searchParams.set("query", "awaiting_my_signature:true");
    const body = this.record(await this.request(credentials, url));
    return {
      signatureRequests: (Array.isArray(body.signature_requests)
        ? body.signature_requests
        : []
      )
        .slice(0, 25)
        .map((value) => this.signatureRequest(value)),
    };
  }

  private url(path: string) {
    if (
      !/^\/v3\/(?:account|signature_request\/(?:list|[0-9A-Fa-f]{24,64}))$/.test(
        path,
      )
    )
      throw new DropboxSignApiError(
        "provider_validation_error",
        "Dropbox Sign API path is invalid.",
      );
    return new URL(path, this.apiOrigin);
  }

  private async request(credentials: DropboxSignCredentials, url: URL) {
    if (!credentials.accessToken.trim())
      throw new DropboxSignApiError(
        "credential_missing",
        "Dropbox Sign access token is required.",
        401,
      );
    if (url.origin !== this.apiOrigin)
      throw new DropboxSignApiError(
        "provider_validation_error",
        "Dropbox Sign request origin is invalid.",
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
          "User-Agent": "RelayConsole-DropboxSign/1.0",
        },
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new DropboxSignApiError(
        "provider_validation_error",
        "Dropbox Sign response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new DropboxSignApiError(
        "provider_validation_error",
        "Dropbox Sign response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new DropboxSignApiError(
        "provider_validation_error",
        "Dropbox Sign returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new DropboxSignApiError(
        this.safeCode(response.status),
        `Dropbox Sign returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: DropboxSignCredentials) {
    if (
      !credentials.accessToken.trim() ||
      !/^[0-9A-Fa-f]{24,64}$/.test(credentials.accountId)
    )
      throw new DropboxSignApiError(
        "credential_missing",
        "Dropbox Sign access token or exact-account binding is missing.",
      );
  }

  private signatureRequest(value: unknown) {
    const item = this.record(value);
    const signatures = Array.isArray(item.signatures) ? item.signatures : [];
    const signatureStatusCounts: Record<string, number> = {};
    for (const value of signatures.slice(0, 1_000)) {
      const status = this.text(this.record(value).status_code, 100);
      if (this.safeStatus(status))
        signatureStatusCounts[status] =
          (signatureStatusCounts[status] ?? 0) + 1;
    }
    return {
      signatureRequestId: this.identifierOrNull(item.signature_request_id),
      title: this.text(item.title, 500) || null,
      subject: this.text(item.subject, 500) || null,
      createdAtEpoch: this.integer(item.created_at),
      expiresAtEpoch: this.integer(item.expires_at),
      complete: item.is_complete === true,
      declined: item.is_declined === true,
      hasError: item.has_error === true,
      testMode: item.test_mode === true,
      signatureCount: Math.min(signatures.length, 1_000),
      signatureStatusCounts,
    };
  }

  private safeStatus(value: string) {
    return [
      "success",
      "on_hold",
      "signed",
      "awaiting_signature",
      "declined",
      "error_unknown",
      "error_file",
      "error_component_position",
      "error_text_tag",
      "on_hold_by_requester",
      "error_invalid_email",
      "expired",
    ].includes(value);
  }

  private identifier(value: unknown, label: string) {
    const text = this.text(value, 64).toLowerCase();
    if (!/^[0-9a-f]{24,64}$/.test(text))
      throw new DropboxSignApiError(
        "provider_validation_error",
        `An exact hexadecimal Dropbox Sign ${label} ID is required.`,
      );
    return text;
  }

  private identifierOrNull(value: unknown) {
    try {
      return this.identifier(value, "signature request");
    } catch {
      return null;
    }
  }

  private locale(value: unknown) {
    const text = this.text(value, 20);
    return /^[A-Za-z]{2}(?:[-_][A-Za-z]{2})?$/.test(text) ? text : null;
  }

  private integer(value: unknown) {
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
      ? value
      : null;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private text(value: unknown, maximum: number) {
    return typeof value === "string" ? value.trim().slice(0, maximum) : "";
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "token_expired";
    if (status === 402 || status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
