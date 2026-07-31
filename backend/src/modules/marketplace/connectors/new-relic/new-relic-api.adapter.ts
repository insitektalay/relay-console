export type NewRelicCredentials = {
  apiKey: string;
  accountId: number;
  region: "us" | "eu";
};

export class NewRelicApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 502,
  ) {
    super(message);
  }
}

type Requester = (url: string, init: RequestInit) => Promise<Response>;

export class NewRelicApiAdapter {
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: NewRelicCredentials) {
    const data = await this.graphql(
      credentials,
      `query RelayNewRelicAccount($accountId: Int!) { actor { account(id: $accountId) { id name } } }`,
      { accountId: credentials.accountId },
    );
    const account = this.record(this.record(this.record(data).actor).account);
    if (Number(account.id) !== credentials.accountId)
      throw new NewRelicApiError(
        "new_relic_account_binding_mismatch",
        "New Relic account binding changed.",
        403,
      );
    return {
      accountId: credentials.accountId,
      accountName: this.text(account.name),
    };
  }

  async searchEntities(
    credentials: NewRelicCredentials,
    input: { query?: unknown; limit?: unknown },
  ) {
    const limit = this.limit(input.limit);
    const suffix = this.optionalText(input.query, 300);
    const query = `accountId = ${credentials.accountId}${suffix ? ` AND name LIKE '${this.escapeSearch(suffix)}'` : ""}`;
    const data = await this.graphql(
      credentials,
      `query RelayNewRelicEntities($query: String!) { actor { entitySearch(query: $query) { count results { entities { guid name entityType reporting domain type ... on AlertableEntityOutline { alertSeverity } } } } } }`,
      { query },
    );
    const search = this.record(
      this.record(this.record(data).actor).entitySearch,
    );
    const results = this.record(search.results);
    const entities = this.array(results.entities)
      .slice(0, limit)
      .map((value) => {
        const entity = this.record(value);
        return {
          guid: this.text(entity.guid),
          name: this.text(entity.name),
          entityType: this.text(entity.entityType),
          domain: this.text(entity.domain),
          type: this.text(entity.type),
          reporting:
            typeof entity.reporting === "boolean" ? entity.reporting : null,
          alertSeverity: this.text(entity.alertSeverity),
        };
      });
    return {
      entities,
      returnedCount: entities.length,
      totalCount: this.number(search.count),
    };
  }

  async getEntity(credentials: NewRelicCredentials, input: { guid: unknown }) {
    const guid = this.requiredGuid(input.guid);
    const data = await this.graphql(
      credentials,
      `query RelayNewRelicEntity($guid: EntityGuid!) { actor { entity(guid: $guid) { guid name entityType reporting domain type tags { key values } ... on AlertableEntity { alertSeverity } } } }`,
      { guid },
    );
    const entity = this.record(this.record(this.record(data).actor).entity);
    return {
      entity: {
        guid: this.text(entity.guid),
        name: this.text(entity.name),
        entityType: this.text(entity.entityType),
        domain: this.text(entity.domain),
        type: this.text(entity.type),
        reporting:
          typeof entity.reporting === "boolean" ? entity.reporting : null,
        alertSeverity: this.text(entity.alertSeverity),
        tags: this.array(entity.tags)
          .slice(0, 25)
          .map((value) => {
            const tag = this.record(value);
            return {
              key: this.text(tag.key),
              values: this.textArray(tag.values),
            };
          }),
      },
    };
  }

  async readAccountHealth(credentials: NewRelicCredentials) {
    const data = await this.graphql(
      credentials,
      `query RelayNewRelicHealth($accountId: Int!) { actor { account(id: $accountId) { id name nrql(query: "SELECT count(*) AS transactions, percentage(count(*), WHERE error IS true) AS errorPercentage, average(duration) AS averageDuration FROM Transaction SINCE 60 MINUTES AGO", timeout: 5) { results } } } }`,
      { accountId: credentials.accountId },
    );
    const account = this.record(this.record(this.record(data).actor).account);
    const results = this.array(this.record(account.nrql).results).slice(0, 1);
    return {
      accountId: credentials.accountId,
      accountName: this.text(account.name),
      windowMinutes: 60,
      transactionHealth: results[0] ?? {},
    };
  }

  private async graphql(
    credentials: NewRelicCredentials,
    query: string,
    variables: Record<string, unknown>,
  ) {
    const response = await this.requester(this.origin(credentials.region), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "API-Key": credentials.apiKey,
        "User-Agent": "RelayConsole-NewRelic/1.0",
      },
      body: JSON.stringify({ query, variables }),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const code =
        response.status === 401
          ? "new_relic_key_invalid"
          : response.status === 403
            ? "new_relic_permission_denied"
            : response.status === 429
              ? "new_relic_rate_limited"
              : "new_relic_unavailable";
      throw new NewRelicApiError(
        code,
        "New Relic NerdGraph request failed.",
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000)
      throw new NewRelicApiError(
        "new_relic_response_too_large",
        "New Relic response exceeded Relay's limit.",
      );
    let body: Record<string, unknown>;
    try {
      body = this.record(JSON.parse(text));
    } catch {
      throw new NewRelicApiError(
        "new_relic_response_invalid",
        "New Relic returned an invalid response.",
      );
    }
    if (this.array(body.errors).length)
      throw new NewRelicApiError(
        "new_relic_graphql_error",
        "New Relic rejected the fixed NerdGraph query.",
        400,
      );
    return this.record(body.data);
  }

  private origin(region: "us" | "eu") {
    if (region === "us") return "https://api.newrelic.com/graphql";
    if (region === "eu") return "https://api.eu.newrelic.com/graphql";
    throw new NewRelicApiError(
      "new_relic_region_invalid",
      "New Relic region must be US or EU.",
      400,
    );
  }

  private limit(value: unknown) {
    if (value === undefined) return 10;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25)
      throw new NewRelicApiError(
        "new_relic_limit_invalid",
        "New Relic result limit must be between 1 and 25.",
        400,
      );
    return Number(value);
  }

  private optionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.length > maxLength)
      throw new NewRelicApiError(
        "new_relic_query_invalid",
        "New Relic entity query is invalid.",
        400,
      );
    return value;
  }

  private escapeSearch(value: string) {
    return value.replace(/[^A-Za-z0-9 ._:/-]/g, "").slice(0, 300);
  }

  private requiredGuid(value: unknown) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(value))
      throw new NewRelicApiError(
        "new_relic_guid_invalid",
        "New Relic entity GUID is invalid.",
        400,
      );
    return value;
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
    return typeof value === "string" ? value.slice(0, 1_000) : null;
  }
  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private textArray(value: unknown) {
    return this.array(value)
      .slice(0, 25)
      .flatMap((item) =>
        typeof item === "string" ? [item.slice(0, 500)] : [],
      );
  }
}
