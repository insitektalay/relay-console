import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type DocusignIdentifyCredentials = {
  accessToken: string;
  accountId?: string;
  baseUri?: string;
};

export class DocusignIdentifyApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class DocusignIdentifyApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: DocusignIdentifyCredentials) {
    const accessToken = this.accessToken(credentials.accessToken);
    const body = this.record(
      await this.request(
        accessToken,
        new URL("https://account.docusign.com/oauth/userinfo"),
        null,
      ),
    );
    const accounts = (Array.isArray(body.accounts) ? body.accounts : []).map(
      (value) => this.record(value),
    );
    const selected =
      accounts.find((value) => value.is_default === true) ?? accounts[0];
    const accountId = this.accountId(selected?.account_id);
    const baseUri = this.baseUri(selected?.base_uri);
    if (!accountId || !baseUri)
      throw new DocusignIdentifyApiError(
        "insufficient_scope",
        "Docusign did not return an exact selected account and regional base URI.",
        403,
      );
    return {
      userId: this.opaqueId(body.sub, 100),
      userName: this.text(body.name, 200) || null,
      accountId,
      accountName: this.text(selected.account_name, 200) || null,
      baseUri,
    };
  }

  async listWorkflows(credentials: DocusignIdentifyCredentials) {
    const accessToken = this.accessToken(credentials.accessToken);
    const accountId = this.accountId(credentials.accountId);
    const baseUri = this.baseUri(credentials.baseUri);
    if (!accountId || !baseUri)
      throw new DocusignIdentifyApiError(
        "credential_missing",
        "Docusign selected-account binding is missing.",
      );
    const url = new URL(
      `/restapi/v2.1/accounts/${accountId}/identify_verification`,
      baseUri,
    );
    const body = this.record(await this.request(accessToken, url, baseUri));
    const workflows = Array.isArray(body.identityVerification)
      ? body.identityVerification
      : [];
    return {
      workflows: workflows.slice(0, 100).map((value) => {
        const item = this.record(value);
        return {
          workflowId: this.text(item.workflowId, 100) || null,
          defaultName: this.text(item.defaultName, 200) || null,
          workflowResourceKey: this.text(item.workflowResourceKey, 200) || null,
          type: this.text(item.type, 100) || null,
          isDefault: item.isDefault === true,
        };
      }),
    };
  }

  private async request(
    accessToken: string,
    url: URL,
    expectedOrigin: string | null,
  ) {
    const userInfo =
      url.origin === "https://account.docusign.com" &&
      url.pathname === "/oauth/userinfo";
    if (
      (!userInfo && url.origin !== expectedOrigin) ||
      (!userInfo &&
        !/^\/restapi\/v2\.1\/accounts\/[0-9A-Fa-f-]{1,64}\/identify_verification$/.test(
          url.pathname,
        )) ||
      url.search ||
      url.hash
    )
      throw new DocusignIdentifyApiError(
        "provider_validation_error",
        "Docusign Identify request boundary is invalid.",
      );
    const response = await this.requester(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "RelayConsole-Docusign-Identify/1.0",
      },
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000)
      throw new DocusignIdentifyApiError(
        "provider_validation_error",
        "Docusign Identify response exceeds the 2 MB Relay boundary.",
      );
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000)
      throw new DocusignIdentifyApiError(
        "provider_validation_error",
        "Docusign Identify response exceeds the 2 MB Relay boundary.",
      );
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new DocusignIdentifyApiError(
        "provider_validation_error",
        "Docusign Identify returned invalid JSON.",
        response.status,
      );
    }
    if (!response.ok)
      throw new DocusignIdentifyApiError(
        this.safeCode(response.status),
        `Docusign Identify returned HTTP ${response.status}.`,
        response.status,
      );
    return body;
  }

  private accessToken(value: unknown) {
    const token = this.text(value, 20_000);
    if (!token)
      throw new DocusignIdentifyApiError(
        "credential_missing",
        "Docusign access token is required.",
        401,
      );
    return token;
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

  private accountId(value: unknown) {
    const text = this.text(value, 64);
    return /^[0-9A-Fa-f-]{1,64}$/.test(text) ? text : "";
  }

  private opaqueId(value: unknown, maximum: number) {
    const text = this.text(value, maximum);
    return /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
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
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
