import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type KajabiCommunitiesCredentials = {
  clientId: string;
  clientSecret: string;
};

export class KajabiCommunitiesApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class KajabiCommunitiesApiAdapter {
  private static readonly origin = "https://api.kajabi.com";
  private readonly tokens = new Map<
    string,
    { accessToken: string; expiresAt: number }
  >();

  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: KajabiCommunitiesCredentials) {
    const token = await this.accessToken(credentials);
    const body = await this.requestJson(credentials, "GET", "/v1/me", token);
    const resource = this.resource(body.data);
    return {
      tokenValid: true,
      user: {
        id: resource.id,
        name: this.scalar(resource.attributes.name),
        email: this.scalar(resource.attributes.email),
      },
    };
  }

  async listSites(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const query = this.pageQuery(input);
    query.set("fields[sites]", "title,subdomain");
    const body = await this.get(credentials, "/v1/sites", query);
    return this.collection(body, (value) => this.site(value));
  }

  async listProducts(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const query = this.pageQuery(input);
    query.set(
      "fields[products]",
      "title,description,status,publish_status,product_type_name,product_type_id,members_aggregate_count",
    );
    const siteId = this.optionalId(input.siteId, "siteId");
    if (siteId) query.set("filter[site_id]", siteId);
    const title = this.optionalText(input.title, "title", 100);
    if (title) query.set("filter[title_cont]", title);
    const body = await this.get(credentials, "/v1/products", query);
    return this.collection(body, (value) => this.product(value));
  }

  async getProduct(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const productId = this.id(input.productId, "productId");
    const query = new URLSearchParams({
      "fields[products]":
        "title,description,status,publish_status,product_type_name,product_type_id,members_aggregate_count",
    });
    const body = await this.get(
      credentials,
      `/v1/products/${encodeURIComponent(productId)}`,
      query,
    );
    return { product: this.product(body.data) };
  }

  async listOffers(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const query = this.pageQuery(input);
    query.set("fields[offers]", "title,description,status,price_in_cents");
    const siteId = this.optionalId(input.siteId, "siteId");
    if (siteId) query.set("filter[site_id]", siteId);
    const title = this.optionalText(input.title, "title", 100);
    if (title) query.set("filter[title_cont]", title);
    const body = await this.get(credentials, "/v1/offers", query);
    return this.collection(body, (value) => this.offer(value));
  }

  async listOfferProducts(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const offerId = this.id(input.offerId, "offerId");
    const query = this.pageQuery(input);
    query.set(
      "fields[products]",
      "title,description,status,publish_status,product_type_name,product_type_id,members_aggregate_count",
    );
    const body = await this.get(
      credentials,
      `/v1/offers/${encodeURIComponent(offerId)}/relationships/products`,
      query,
    );
    return {
      offerId,
      ...this.collection(body, (value) => this.product(value)),
    };
  }

  async listContacts(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const siteId = this.id(input.siteId, "siteId");
    const query = this.pageQuery(input);
    query.set("filter[site_id]", siteId);
    query.set("fields[contacts]", "name,email,created_at,updated_at");
    const search = this.optionalText(input.search, "search", 100);
    if (search) query.set("filter[search]", search);
    const offerId = this.optionalId(input.offerId, "offerId");
    if (offerId) query.set("filter[has_offer_id]", offerId);
    const body = await this.get(credentials, "/v1/contacts", query);
    return this.collection(body, (value) => this.contact(value));
  }

  async listContactOffers(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const contactId = this.id(input.contactId, "contactId");
    const query = this.pageQuery(input);
    query.set("fields[offers]", "title,description,status,price_in_cents");
    const body = await this.get(
      credentials,
      `/v1/contacts/${encodeURIComponent(contactId)}/relationships/offers`,
      query,
    );
    return {
      contactId,
      ...this.collection(body, (value) => this.offer(value)),
    };
  }

  async grantOffer(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const contactId = this.id(input.contactId, "contactId");
    const offerId = this.id(input.offerId, "offerId");
    await this.write(
      credentials,
      "POST",
      `/v1/contacts/${encodeURIComponent(contactId)}/relationships/offers`,
      {
        data: [{ type: "offers", id: offerId }],
        meta: { send_customer_welcome_email: false },
      },
    );
    return { contactId, offerId, granted: true, welcomeEmailSent: false };
  }

  async revokeOffer(
    credentials: KajabiCommunitiesCredentials,
    input: JsonObject,
  ) {
    const contactId = this.id(input.contactId, "contactId");
    const offerId = this.id(input.offerId, "offerId");
    await this.write(
      credentials,
      "DELETE",
      `/v1/contacts/${encodeURIComponent(contactId)}/relationships/offers`,
      { data: [{ type: "offers", id: offerId }] },
    );
    return { contactId, offerId, revoked: true };
  }

  private async get(
    credentials: KajabiCommunitiesCredentials,
    path: string,
    query?: URLSearchParams,
  ) {
    const suffix = query?.size ? `?${query}` : "";
    return await this.requestJson(credentials, "GET", `${path}${suffix}`);
  }

  private async write(
    credentials: KajabiCommunitiesCredentials,
    method: "POST" | "DELETE",
    path: string,
    body: JsonObject,
  ) {
    return await this.requestJson(credentials, method, path, undefined, body);
  }

  private async requestJson(
    credentials: KajabiCommunitiesCredentials,
    method: "GET" | "POST" | "DELETE",
    path: string,
    knownToken?: { accessToken: string },
    body?: JsonObject,
  ) {
    const url = new URL(path, KajabiCommunitiesApiAdapter.origin);
    if (url.origin !== KajabiCommunitiesApiAdapter.origin)
      throw new KajabiCommunitiesApiError(
        "policy_blocked",
        "Kajabi request left the fixed API boundary.",
        403,
      );
    const token = knownToken ?? (await this.accessToken(credentials));
    return await this.fetchJson(url.toString(), {
      method,
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${token.accessToken}`,
        ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  }

  private async accessToken(credentials: KajabiCommunitiesCredentials) {
    if (!credentials.clientId.trim() || !credentials.clientSecret.trim())
      throw new KajabiCommunitiesApiError(
        "credential_missing",
        "Kajabi API client credentials are missing.",
      );
    const key = createHash("sha256")
      .update(`${credentials.clientId}\0${credentials.clientSecret}`)
      .digest("hex");
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
    const form = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "client_credentials",
    });
    const body = await this.fetchJson(
      `${KajabiCommunitiesApiAdapter.origin}/v1/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      },
    );
    const accessToken = this.scalar(body.access_token);
    const expiresIn = this.number(body.expires_in);
    if (!accessToken || !expiresIn || expiresIn < 1)
      throw new KajabiCommunitiesApiError(
        "token_refresh_failed",
        "Kajabi did not return a usable access token.",
      );
    const value = {
      accessToken,
      expiresAt: Date.now() + Math.min(expiresIn, 86_400) * 1_000,
    };
    this.tokens.set(key, value);
    return value;
  }

  private async fetchJson(url: string, init: RequestInit): Promise<JsonObject> {
    let response: Response;
    try {
      response = await this.request(url, init);
    } catch {
      throw new KajabiCommunitiesApiError(
        "provider_unavailable",
        "Kajabi is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new KajabiCommunitiesApiError(
        "provider_validation_error",
        "Kajabi response exceeded the safe size limit.",
      );
    let parsed: unknown = {};
    try {
      parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new KajabiCommunitiesApiError(
        "provider_validation_error",
        "Kajabi returned an invalid response.",
      );
    }
    const body = this.object(parsed) ?? {};
    if (!response.ok)
      throw new KajabiCommunitiesApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 404
              ? "provider_validation_error"
              : response.status === 429
                ? "provider_rate_limited"
                : response.status >= 500
                  ? "provider_unavailable"
                  : "provider_validation_error",
        "Kajabi API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return body;
  }

  private pageQuery(input: JsonObject) {
    return new URLSearchParams({
      "page[number]": String(this.integer(input.page, 1, 10_000, 1)),
      "page[size]": String(this.integer(input.maxResults, 1, 25, 25)),
    });
  }

  private collection<T>(body: JsonObject, map: (value: unknown) => T) {
    const meta = this.object(body.meta) ?? {};
    return {
      items: this.array(body.data).slice(0, 25).map(map),
      page: this.integerScalar(meta.current_page),
      totalPages: this.integerScalar(meta.total_pages),
      totalCount: this.integerScalar(meta.total_count),
    };
  }

  private site(value: unknown) {
    const item = this.resource(value);
    return {
      id: item.id,
      title: this.scalar(item.attributes.title),
      subdomain: this.scalar(item.attributes.subdomain),
    };
  }

  private product(value: unknown) {
    const item = this.resource(value);
    return {
      id: item.id,
      title: this.scalar(item.attributes.title),
      description: this.scalar(item.attributes.description),
      status: this.scalar(item.attributes.status),
      publishStatus: this.scalar(item.attributes.publish_status),
      productTypeName: this.scalar(item.attributes.product_type_name),
      productTypeId: this.integerScalar(item.attributes.product_type_id),
      memberCount: this.integerScalar(item.attributes.members_aggregate_count),
      siteId: this.relationshipId(item.relationships.site),
    };
  }

  private offer(value: unknown) {
    const item = this.resource(value);
    return {
      id: item.id,
      title: this.scalar(item.attributes.title),
      description: this.scalar(item.attributes.description),
      status: this.scalar(item.attributes.status),
      priceInCents: this.integerScalar(item.attributes.price_in_cents),
      siteId: this.relationshipId(item.relationships.site),
    };
  }

  private contact(value: unknown) {
    const item = this.resource(value);
    return {
      id: item.id,
      name: this.scalar(item.attributes.name),
      email: this.scalar(item.attributes.email),
      createdAt: this.scalar(item.attributes.created_at),
      updatedAt: this.scalar(item.attributes.updated_at),
      siteId: this.relationshipId(item.relationships.site),
    };
  }

  private resource(value: unknown) {
    const item = this.object(value) ?? {};
    return {
      id: this.scalar(item.id),
      attributes: this.object(item.attributes) ?? {},
      relationships: this.object(item.relationships) ?? {},
    };
  }

  private relationshipId(value: unknown) {
    return this.scalar(this.object(this.object(value)?.data)?.id);
  }

  private id(value: unknown, field: string) {
    const result = this.optionalId(value, field);
    if (!result)
      throw new KajabiCommunitiesApiError(
        "provider_validation_error",
        `Kajabi ${field} is required.`,
      );
    return result;
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(value))
      throw new KajabiCommunitiesApiError(
        "provider_validation_error",
        `Kajabi ${field} is invalid.`,
      );
    return value;
  }

  private optionalText(value: unknown, field: string, maximum: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !value.trim() || value.length > maximum)
      throw new KajabiCommunitiesApiError(
        "provider_validation_error",
        `Kajabi ${field} is invalid.`,
      );
    return value.trim();
  }

  private integer(
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number,
  ) {
    if (value === undefined || value === null) return fallback;
    if (
      !Number.isInteger(value) ||
      Number(value) < minimum ||
      Number(value) > maximum
    )
      throw new KajabiCommunitiesApiError(
        "provider_validation_error",
        "Kajabi pagination is invalid.",
      );
    return Number(value);
  }

  private object(value: unknown): JsonObject | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private scalar(value: unknown): string | null {
    return typeof value === "string" || typeof value === "number"
      ? String(value).slice(0, 2_000)
      : null;
  }

  private number(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private integerScalar(value: unknown) {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }
}
