export const LEVER_API_ORIGIN = "https://api.lever.co/v1";
export const LEVER_AUDIENCE = "https://api.lever.co/v1/";
export const LEVER_SCOPES = [
  "offline_access",
  "postings:read:admin",
  "stages:read:admin",
];
export type LeverCredentials = { accessToken: string; accountId: string };
export class LeverApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}
type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class LeverApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}
  async health(credentials: LeverCredentials) {
    await this.listStages(credentials, { limit: 1 });
    return { ready: true, accountId: this.accountId(credentials.accountId) };
  }
  async listPostings(
    credentials: LeverCredentials,
    input: { limit?: unknown },
  ) {
    this.accountId(credentials.accountId);
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(
        credentials,
        `/postings?limit=${limit}&confidentiality=non-confidential`,
      ),
    );
    return {
      postings: this.array(root.data)
        .slice(0, limit)
        .map((value) => this.posting(value)),
      limit,
      automaticPagination: false,
      confidentialDataReturned: false,
      candidateDataReturned: false,
    };
  }
  async listStages(credentials: LeverCredentials, input: { limit?: unknown }) {
    this.accountId(credentials.accountId);
    const limit = this.limit(input.limit);
    const root = this.record(
      await this.request(credentials, `/stages?limit=${limit}`),
    );
    return {
      stages: this.array(root.data)
        .slice(0, limit)
        .map((value) => this.stage(value)),
      limit,
      automaticPagination: false,
      confidentialDataReturned: false,
      candidateDataReturned: false,
    };
  }
  private async request(credentials: LeverCredentials, path: string) {
    if (
      !/^\/(?:postings\?limit=(?:[1-9]|1[0-9]|2[0-5])&confidentiality=non-confidential|stages\?limit=(?:[1-9]|1[0-9]|2[0-5]))$/.test(
        path,
      )
    )
      throw new LeverApiError(
        "lever_path_invalid",
        "Lever API path is invalid.",
        400,
      );
    if (!credentials.accessToken || credentials.accessToken.length > 30_000)
      throw new LeverApiError(
        "lever_credential_missing",
        "Lever OAuth access token is missing.",
        401,
      );
    const response = await this.requester(`${LEVER_API_ORIGIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credentials.accessToken}`,
        "User-Agent": "RelayConsole-Lever/1.0",
      },
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "lever_token_invalid"
          : response.status === 403
            ? "lever_scope_or_admin_denied"
            : response.status === 404
              ? "lever_resource_not_found"
              : response.status === 429 || response.status === 503
                ? "lever_rate_limited"
                : "lever_unavailable";
      throw new LeverApiError(
        code,
        "Lever Data API request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new LeverApiError(
        "lever_response_too_large",
        "Lever response exceeded Relay's limit.",
      );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new LeverApiError(
        "lever_response_invalid",
        "Lever returned an invalid response.",
      );
    }
  }
  private posting(value: unknown) {
    const posting = this.record(value);
    const categories = this.record(posting.categories);
    return {
      id: this.text(posting.id),
      text: this.text(posting.text),
      state: this.text(posting.state),
      confidentiality: this.text(posting.confidentiality),
      team: this.text(categories.team),
      department: this.text(categories.department),
      location: this.text(categories.location),
      commitment: this.text(categories.commitment),
      workplaceType: this.text(posting.workplaceType),
      distributionChannels: this.array(posting.distributionChannels)
        .slice(0, 10)
        .map((v) => this.text(v)),
      createdAt: this.integer(posting.createdAt),
      updatedAt: this.integer(posting.updatedAt),
      contentReturned: false,
      salaryReturned: false,
      peopleReturned: false,
      candidateDataReturned: false,
    };
  }
  private stage(value: unknown) {
    const stage = this.record(value);
    return {
      id: this.text(stage.id),
      text: this.text(stage.text),
      candidateDataReturned: false,
    };
  }
  private accountId(value: unknown) {
    const text = this.text(value);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(text))
      throw new LeverApiError(
        "lever_account_id_invalid",
        "Lever Account ID is invalid.",
        400,
      );
    return text;
  }
  private limit(value: unknown) {
    const limit = value === undefined ? 25 : Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25)
      throw new LeverApiError(
        "lever_limit_invalid",
        "Lever limit must be an integer from 1 through 25.",
        400,
      );
    return limit;
  }
  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private text(value: unknown) {
    return typeof value === "string" ? value.slice(0, 1_200) : "";
  }
  private integer(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : null;
  }
}
