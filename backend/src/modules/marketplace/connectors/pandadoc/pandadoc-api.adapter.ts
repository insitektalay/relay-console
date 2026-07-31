import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type PandaDocCredentials = {
  accessToken: string;
  membershipId: string;
  workspaceId: string;
};

export class PandaDocApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class PandaDocApiAdapter {
  private readonly apiOrigin = "https://api.pandadoc.com";

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: PandaDocCredentials) {
    this.validateCredentials(credentials);
    const membersUrl = this.url("/public/v1/members");
    membersUrl.searchParams.set("count", "25");
    membersUrl.searchParams.set("page", "1");
    const workspacesUrl = this.url("/public/v1/workspaces");
    workspacesUrl.searchParams.set("count", "25");
    workspacesUrl.searchParams.set("page", "1");
    const members = this.results(
      await this.request(credentials, membersUrl),
    ).map((value) => this.record(value));
    const workspaces = this.results(
      await this.request(credentials, workspacesUrl),
    ).map((value) => this.record(value));
    const member = members.find(
      (value) => this.resourceId(value) === credentials.membershipId,
    );
    const workspace = workspaces.find(
      (value) => this.resourceId(value) === credentials.workspaceId,
    );
    if (!member || !workspace)
      throw new PandaDocApiError(
        "insufficient_scope",
        "PandaDoc membership or token-bound workspace binding changed.",
        403,
      );
    return {
      membershipId: credentials.membershipId,
      membershipLabel:
        this.text(member.name, 200) || this.text(member.email, 320) || null,
      workspaceId: credentials.workspaceId,
      workspaceName: this.text(workspace.name, 200) || null,
      apiOrigin: `${this.apiOrigin}/public/v1`,
    };
  }

  async listRecentDocuments(
    credentials: PandaDocCredentials,
    now = new Date(),
  ) {
    this.validateCredentials(credentials);
    const url = this.url("/public/v1/documents");
    url.searchParams.set(
      "created_from",
      new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    );
    url.searchParams.set("created_to", now.toISOString());
    url.searchParams.set("count", "25");
    url.searchParams.set("page", "1");
    url.searchParams.set("order_by", "-date_created");
    return {
      documents: this.results(await this.request(credentials, url))
        .slice(0, 25)
        .map((value) => this.document(value)),
    };
  }

  async getDocumentStatus(
    credentials: PandaDocCredentials,
    input: { documentId: string },
  ) {
    this.validateCredentials(credentials);
    const id = this.identifier(input.documentId, "Document");
    const body = this.record(
      await this.request(credentials, this.url(`/public/v1/documents/${id}`)),
    );
    return { document: this.document(body.document ?? body) };
  }

  async listDocumentFolders(credentials: PandaDocCredentials) {
    this.validateCredentials(credentials);
    const url = this.url("/public/v1/documents/folders");
    url.searchParams.set("count", "25");
    url.searchParams.set("page", "1");
    return {
      folders: this.results(await this.request(credentials, url))
        .slice(0, 25)
        .map((value) => this.folder(value)),
    };
  }

  private url(path: string) {
    if (
      !/^\/public\/v1\/(?:members|workspaces|documents(?:\/folders|\/[A-Za-z0-9_-]{1,64})?)$/.test(
        path,
      ) ||
      path.includes("/details")
    )
      throw new PandaDocApiError(
        "provider_validation_error",
        "PandaDoc API path is invalid.",
      );
    return new URL(path, this.apiOrigin);
  }

  private async request(credentials: PandaDocCredentials, url: URL) {
    if (!credentials.accessToken.trim())
      throw new PandaDocApiError(
        "credential_missing",
        "PandaDoc access token is required.",
        401,
      );
    if (url.origin !== this.apiOrigin)
      throw new PandaDocApiError(
        "provider_validation_error",
        "PandaDoc request origin is invalid.",
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
          "User-Agent": "RelayConsole-PandaDoc/1.0",
        },
      }),
    );
  }

  private async response(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new PandaDocApiError(
        "provider_validation_error",
        "PandaDoc response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new PandaDocApiError(
        "provider_validation_error",
        "PandaDoc response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new PandaDocApiError(
        "provider_validation_error",
        "PandaDoc returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new PandaDocApiError(
        this.safeCode(response.status),
        `PandaDoc returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private validateCredentials(credentials: PandaDocCredentials) {
    if (
      !credentials.accessToken.trim() ||
      !this.safeId(credentials.membershipId) ||
      !this.safeId(credentials.workspaceId)
    )
      throw new PandaDocApiError(
        "credential_missing",
        "PandaDoc access token, membership, or workspace binding is missing.",
      );
  }

  private document(value: unknown) {
    const item = this.record(value);
    return {
      documentId: this.idOrNull(item.id ?? item.uuid),
      name: this.text(item.name, 500) || null,
      status: this.text(item.status, 100) || null,
      createdAt: this.date(item.date_created),
      modifiedAt: this.date(item.date_modified),
      statusChangedAt: this.date(item.date_status_changed),
      completedAt: this.date(item.date_completed),
      expiresAt: this.date(item.date_expiration),
    };
  }

  private folder(value: unknown) {
    const item = this.record(value);
    return {
      folderId: this.idOrNull(item.uuid ?? item.id),
      name: this.text(item.name, 500) || null,
    };
  }

  private results(value: unknown) {
    const body = this.record(value);
    return Array.isArray(body.results) ? body.results : [];
  }

  private resourceId(value: JsonObject) {
    return this.text(value.id ?? value.uuid ?? value.membership_id, 64);
  }

  private identifier(value: unknown, label: string) {
    const text = this.text(value, 64);
    if (!this.safeId(text))
      throw new PandaDocApiError(
        "provider_validation_error",
        `An exact safe PandaDoc ${label} ID is required.`,
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
