import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
export type ContractbookCredentials = { apiKey: string };

export class ContractbookApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class ContractbookApiAdapter {
  private static readonly ORIGIN = "https://api.contractbook.com";
  private static readonly DOCUMENTS_PATH = "/v3/documents";

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: ContractbookCredentials) {
    await this.fetchDocuments(credentials, 1);
    return {
      apiKeyVerified: true,
      productionEnvironmentBound: true,
      providerRequestCount: 1,
      documentDataReturned: false,
      peopleReturned: false,
      writesEnabled: false,
    };
  }

  async listDocumentLifecycles(
    credentials: ContractbookCredentials,
    input: JsonObject,
  ) {
    const limit = this.limit(input.limit);
    const value = this.object(await this.fetchDocuments(credentials, limit));
    const documents = Array.isArray(value.documents) ? value.documents : [];
    return {
      semanticReadContract: "contractbook-document-lifecycle-list-v1",
      documents: documents.slice(0, limit).map((entry) => {
        const document = this.object(entry);
        return {
          documentId: this.scalar(document.id, 36),
          type: this.enumValue(document.type, [
            "draft",
            "contract",
            "stored_contract",
          ]),
          state: this.enumValue(document.state, [
            "draft",
            "rejected",
            "changes_requested",
            "pending",
            "signed",
            "irrelevant",
          ]),
          createdAt: this.scalar(document.created_at, 64),
          updatedAt: this.scalar(document.updated_at, 64),
          signedAt: this.scalar(document.signed_at, 64),
        };
      }),
      returnedCount: Math.min(documents.length, limit),
      maxResults: limit,
      providerRequestCount: 1,
      fullResponseRequested: false,
      titlesReturned: false,
      ownersReturned: false,
      partiesReturned: false,
      emailsReturned: false,
      dataFieldsReturned: false,
      tagsReturned: false,
      workspacesReturned: false,
      foldersReturned: false,
      commentsReturned: false,
      tasksReturned: false,
      paginationCursorReturned: false,
      rawProviderResponseReturned: false,
      writesEnabled: false,
      automaticPagination: false,
      automaticRetries: false,
    };
  }

  private async fetchDocuments(
    credentials: ContractbookCredentials,
    limit: number,
  ) {
    const apiKey = this.apiKey(credentials);
    const url = new URL(
      ContractbookApiAdapter.DOCUMENTS_PATH,
      `${ContractbookApiAdapter.ORIGIN}/`,
    );
    url.searchParams.set("page_size", String(limit));
    url.searchParams.set("full", "false");
    if (
      url.origin !== ContractbookApiAdapter.ORIGIN ||
      url.pathname !== ContractbookApiAdapter.DOCUMENTS_PATH ||
      [...url.searchParams.keys()].some(
        (key) => !["page_size", "full"].includes(key),
      ) ||
      url.searchParams.get("full") !== "false" ||
      url.hash
    )
      throw new ContractbookApiError(
        "policy_blocked",
        "Contractbook request escaped Relay's fixed document-lifecycle allowlist.",
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
        cache: "no-store",
      });
    } catch {
      throw new ContractbookApiError(
        "provider_unavailable",
        "Contractbook could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw this.validation(
        "Contractbook response exceeded Relay's 1 MB bound.",
      );
    let value: unknown = {};
    try {
      value = raw ? JSON.parse(raw) : {};
    } catch {
      throw this.validation("Contractbook returned invalid JSON.");
    }
    if (!response.ok)
      throw new ContractbookApiError(
        this.errorCode(response.status),
        "Contractbook rejected the bounded request.",
        response.status,
      );
    return value;
  }

  private apiKey(credentials: ContractbookCredentials) {
    const apiKey = credentials.apiKey?.trim();
    if (!apiKey || apiKey.length > 20_000)
      throw new ContractbookApiError(
        "credential_missing",
        "Contractbook API key is missing.",
        401,
      );
    return apiKey;
  }

  private limit(value: unknown) {
    if (value === undefined) return 25;
    if (
      !Number.isSafeInteger(value) ||
      Number(value) < 1 ||
      Number(value) > 25
    )
      throw this.validation("limit must be an integer from 1 to 25.");
    return Number(value);
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private scalar(value: unknown, max: number) {
    return typeof value === "string" && value ? value.slice(0, max) : null;
  }

  private enumValue(value: unknown, allowed: string[]) {
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }

  private errorCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 402) return "connection_not_ready";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private validation(message: string) {
    return new ContractbookApiError("provider_validation_error", message);
  }
}
