import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type GrooveCredentials = {
  apiToken: string;
  accountId?: string;
};

export class GrooveApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GrooveApiAdapter {
  private static readonly endpoint = "https://api.groovehq.com/v2/graphql";
  private static readonly identityQuery = `
    query RelayGrooveIdentity {
      ping
      account {
        id
        subdomain
        state
      }
    }
  `;

  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: GrooveCredentials) {
    const data = await this.rawGraphql(
      credentials,
      GrooveApiAdapter.identityQuery,
      {},
    );
    return this.account(credentials, data);
  }

  async getAccount(credentials: GrooveCredentials) {
    return { account: await this.health(credentials) };
  }

  async listChannels(
    credentials: GrooveCredentials,
    input: { limit?: number } = {},
  ) {
    const data = await this.rawGraphql(
      credentials,
      `
        query RelayGrooveChannels($first: Int!) {
          account { id }
          channels(first: $first) {
            nodes {
              __typename
              id
              name
              conversationCount
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      { first: this.limit(input.limit) },
    );
    this.account(credentials, data);
    const channels = this.record(data.channels);
    return {
      channels: this.array(channels.nodes).map((item) => {
        const channel = this.record(item);
        return {
          type: this.text(channel.__typename, 100),
          id: this.identifier(channel.id),
          name: this.text(channel.name, 300),
          conversationCount: this.nonNegativeInteger(channel.conversationCount),
        };
      }),
      pageInfo: this.redact(this.record(channels.pageInfo)),
    };
  }

  async graphql(
    credentials: GrooveCredentials,
    input: { query: string; variables?: JsonObject },
  ) {
    const query = this.query(input.query);
    this.rejectCredentialFields(input.variables);
    await this.health(credentials);
    return {
      data: this.redact(
        await this.rawGraphql(credentials, query, input.variables ?? {}),
      ),
    };
  }

  private async rawGraphql(
    credentials: GrooveCredentials,
    query: string,
    variables: JsonObject,
  ) {
    const apiToken = credentials.apiToken.trim();
    if (!apiToken) {
      throw new GrooveApiError(
        "credential_missing",
        "Groove API token is required.",
        401,
      );
    }
    const serialized = JSON.stringify({ query: this.query(query), variables });
    if (Buffer.byteLength(serialized, "utf8") > 1_000_000) {
      throw new GrooveApiError(
        "provider_validation_error",
        "Groove GraphQL request exceeds the 1 MB Relay boundary.",
      );
    }
    const response = await this.requester(GrooveApiAdapter.endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "User-Agent": "RelayConsole-Groove/1.0",
      },
      body: serialized,
    });
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > 2_000_000) {
      throw new GrooveApiError(
        "provider_validation_error",
        "Groove response exceeds the 2 MB Relay boundary.",
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 2_000_000) {
      throw new GrooveApiError(
        "provider_validation_error",
        "Groove response exceeds the 2 MB Relay boundary.",
      );
    }
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      throw new GrooveApiError(
        "provider_unavailable",
        "Groove returned an invalid GraphQL response.",
        response.status,
      );
    }
    const object = this.record(body);
    if (!response.ok) {
      throw new GrooveApiError(
        this.safeCode(response.status),
        this.errorMessage(object) ?? `Groove returned HTTP ${response.status}.`,
        response.status,
      );
    }
    if (this.array(object.errors).length) {
      throw new GrooveApiError(
        "provider_validation_error",
        this.errorMessage(object) ?? "Groove rejected the GraphQL operation.",
        response.status,
      );
    }
    return this.record(object.data);
  }

  private account(credentials: GrooveCredentials, data: JsonObject) {
    const account = this.record(data.account);
    const accountId = this.identifier(account.id);
    if (
      !accountId ||
      (credentials.accountId?.trim() &&
        accountId !== credentials.accountId.trim())
    ) {
      throw new GrooveApiError(
        "insufficient_scope",
        "Groove did not return the exact account bound to this API token.",
        403,
      );
    }
    return {
      id: accountId,
      subdomain: this.text(account.subdomain, 200),
      state: this.text(account.state, 100),
      ping: this.text(data.ping, 100),
    };
  }

  private query(value: unknown) {
    if (typeof value !== "string") {
      throw new GrooveApiError(
        "provider_validation_error",
        "Groove GraphQL query is required.",
      );
    }
    const normalized = value.trim();
    if (!normalized || Buffer.byteLength(normalized, "utf8") > 100_000) {
      throw new GrooveApiError(
        "provider_validation_error",
        "Groove GraphQL query must be between 1 byte and 100 KB.",
      );
    }
    return normalized;
  }

  private rejectCredentialFields(value?: JsonObject) {
    if (!value) return;
    const walk = (item: unknown, depth = 0) => {
      if (depth > 12) {
        throw new GrooveApiError(
          "policy_blocked",
          "Groove variables are too deeply nested.",
          403,
        );
      }
      if (Array.isArray(item)) {
        item.forEach((entry) => walk(entry, depth + 1));
        return;
      }
      if (!item || typeof item !== "object") return;
      for (const [key, entry] of Object.entries(item as JsonObject)) {
        if (
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
        ) {
          throw new GrooveApiError(
            "policy_blocked",
            `Credential-bearing variable ${key} is not allowed.`,
            403,
          );
        }
        walk(entry, depth + 1);
      }
    };
    walk(value);
  }

  private redact(value: unknown, depth = 0): unknown {
    if (depth > 8) return "[truncated]";
    if (typeof value === "string") return value.slice(0, 500_000);
    if (Array.isArray(value)) {
      return value.slice(0, 1000).map((item) => this.redact(item, depth + 1));
    }
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value as JsonObject)
        .slice(0, 1000)
        .map(([key, item]) => [
          key,
          /(token|secret|authorization|password|cookie|credential|api.?key)/i.test(
            key,
          )
            ? "[redacted]"
            : this.redact(item, depth + 1),
        ]),
    );
  }

  private errorMessage(value: JsonObject) {
    const messages = this.array(value.errors)
      .map((item) => this.text(this.record(item).message, 500))
      .filter(Boolean);
    if (messages.length) return messages.join("; ").slice(0, 500);
    const candidate = value.message ?? value.error_description ?? value.error;
    return typeof candidate === "string" ? candidate.slice(0, 500) : null;
  }

  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }

  private limit(value: unknown) {
    return typeof value === "number" && Number.isInteger(value)
      ? Math.max(1, Math.min(25, value))
      : 25;
  }

  private record(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" ? value.slice(0, max) : null;
  }

  private identifier(value: unknown) {
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, 200)
      : null;
  }

  private nonNegativeInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : null;
  }
}
