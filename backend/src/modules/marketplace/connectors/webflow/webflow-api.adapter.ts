import { safeConnectorFetch } from "../safe-connector-fetch";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class WebflowApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

@Injectable()
export class WebflowApiAdapter {
  private readonly origin = "https://api.webflow.com";

  async authorization(token: string) {
    const value = await this.request(token, "GET", "/v2/token/introspect");
    const authorization = this.object(value.authorization);
    const authorizedTo = this.object(authorization.authorizedTo);
    const id = this.text(authorization.id);
    if (!id)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow did not return authorization information.",
      );
    return {
      authorization: {
        id,
        grantType: this.text(authorization.grantType),
        rateLimit: this.numeric(authorization.rateLimit),
        scopes: this.scopeList(authorization.scope),
        siteIds: this.ids(authorizedTo.siteIds, 100),
        workspaceIds: this.ids(authorizedTo.workspaceIds, 100),
        userIds: this.ids(authorizedTo.userIds, 20),
      },
      application: this.application(value.application),
      providerRequestCount: 1,
    };
  }

  async listSites(token: string) {
    const value = await this.request(token, "GET", "/v2/sites");
    const sites = this.array(value.sites)
      .slice(0, 25)
      .map((item) => this.site(item));
    return {
      sites,
      count: sites.length,
      truncated: this.array(value.sites).length > sites.length,
      providerRequestCount: 1,
    };
  }
  async getSite(token: string, input: JsonObject) {
    const siteId = this.id(input.siteId, "siteId");
    return {
      site: this.site(
        await this.request(token, "GET", `/v2/sites/${this.segment(siteId)}`),
      ),
      providerRequestCount: 1,
    };
  }
  async listCollections(token: string, input: JsonObject) {
    const siteId = this.id(input.siteId, "siteId");
    const value = await this.request(
      token,
      "GET",
      `/v2/sites/${this.segment(siteId)}/collections`,
    );
    const collections = this.array(value.collections)
      .slice(0, 25)
      .map((item) => this.collection(item, false));
    return {
      siteId,
      collections,
      count: collections.length,
      truncated: this.array(value.collections).length > collections.length,
      providerRequestCount: 1,
    };
  }
  async getCollection(token: string, input: JsonObject) {
    const collectionId = this.id(input.collectionId, "collectionId");
    return {
      collection: this.collection(
        await this.request(
          token,
          "GET",
          `/v2/collections/${this.segment(collectionId)}`,
        ),
        true,
      ),
      providerRequestCount: 1,
    };
  }
  async listStagedItems(token: string, input: JsonObject) {
    const collectionId = this.id(input.collectionId, "collectionId");
    const maxResults = this.limit(input.maxResults, 25, 100);
    const offset = this.offset(input.offset);
    const locale = this.optionalId(input.cmsLocaleId, "cmsLocaleId");
    const value = await this.request(
      token,
      "GET",
      `/v2/collections/${this.segment(collectionId)}/items`,
      {
        limit: String(maxResults),
        offset: String(offset),
        ...(locale ? { cmsLocaleId: locale } : {}),
      },
    );
    const items = this.array(value.items)
      .slice(0, maxResults)
      .map((item) => this.item(item));
    return {
      collectionId,
      items,
      count: items.length,
      pagination: this.pagination(value.pagination, maxResults, offset),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async getStagedItem(token: string, input: JsonObject) {
    const collectionId = this.id(input.collectionId, "collectionId");
    const itemId = this.id(input.itemId, "itemId");
    const locale = this.optionalId(input.cmsLocaleId, "cmsLocaleId");
    const value = await this.request(
      token,
      "GET",
      `/v2/collections/${this.segment(collectionId)}/items/${this.segment(itemId)}`,
      locale ? { cmsLocaleId: locale } : {},
    );
    return { collectionId, item: this.item(value), providerRequestCount: 1 };
  }
  prepareItemChange(input: JsonObject) {
    const change = this.normalizedChange(input);
    return {
      change,
      digest: this.digest(change),
      providerMutation: false,
      providerRequestCount: 0,
    };
  }
  async updateStagedItem(token: string, input: JsonObject) {
    const change = this.normalizedUpdate(input);
    const entry: JsonObject = {
      id: change.itemId,
      fieldData: change.fieldData,
      ...(change.cmsLocaleId ? { cmsLocaleId: change.cmsLocaleId } : {}),
    };
    const value = await this.request(
      token,
      "PATCH",
      `/v2/collections/${this.segment(change.collectionId)}/items`,
      { skipInvalidFiles: "false" },
      { items: [entry] },
    );
    const returned = this.array(value.items)[0] ?? value;
    return {
      operation: "update",
      contentState: "staged",
      item: this.item(returned),
      digest: this.digest(change),
      idempotencyKey: this.id(input.idempotencyKey, "idempotencyKey"),
      providerRequestCount: 1,
    };
  }
  async publishItems(token: string, input: JsonObject) {
    const change = this.normalizedPublish(input);
    const value = await this.request(
      token,
      "POST",
      `/v2/collections/${this.segment(change.collectionId)}/items/publish`,
      {},
      {
        itemIds: change.itemIds,
        ...(change.cmsLocaleIds ? { cmsLocaleIds: change.cmsLocaleIds } : {}),
      },
    );
    return {
      operation: "publish",
      contentState: "live",
      publishedItemIds: this.ids(value.publishedItemIds, 25),
      errors: this.array(value.errors)
        .slice(0, 25)
        .map((item) => this.bounded(this.text(item), 2000))
        .filter(Boolean),
      digest: this.digest(change),
      idempotencyKey: this.id(input.idempotencyKey, "idempotencyKey"),
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    method: string,
    path: string,
    query: Record<string, string> = {},
    body?: JsonObject,
  ): Promise<JsonObject> {
    if (!token || token.length > 10000)
      throw new WebflowApiError(
        "credential_missing",
        "A Webflow OAuth access token is required.",
        401,
      );
    if (!path.startsWith("/v2/") || path.includes("..") || path.includes("//"))
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow API path is invalid.",
      );
    const url = new URL(`${this.origin}${path}`);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const encoded = body ? JSON.stringify(body) : undefined;
    if (encoded && Buffer.byteLength(encoded) > 200000)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow request exceeds 200 KB.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(encoded ? { "Content-Type": "application/json" } : {}),
        },
        body: encoded,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new WebflowApiError(
        "provider_unavailable",
        "Webflow could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (raw.length > 4000000)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow response exceeded Relay bounds.",
      );
    let value: JsonObject = {};
    try {
      value = this.object(raw ? JSON.parse(raw) : {});
    } catch {
      value = {};
    }
    if (!response.ok)
      throw new WebflowApiError(
        this.code(response.status),
        response.status === 429
          ? `Webflow rate limit reached; retry after ${response.headers.get("retry-after") ?? "the provider window"}.`
          : response.status === 401
            ? "Webflow authorization is invalid; reconnect the App."
            : response.status === 403
              ? "Webflow denied the requested scope or resource permission."
              : response.status === 409
                ? "Webflow reported a CMS conflict; reload the staged item before retrying."
                : "Webflow rejected the request.",
        response.status,
      );
    return value;
  }
  private normalizedChange(input: JsonObject): JsonObject {
    const operation = this.text(input.operation);
    if (operation === "update") return this.normalizedUpdate(input);
    if (operation === "publish") return this.normalizedPublish(input);
    throw new WebflowApiError(
      "provider_validation_error",
      "Webflow operation must be update or publish.",
    );
  }
  private normalizedUpdate(input: JsonObject) {
    const fieldData = this.fieldData(input.fieldData);
    return {
      operation: "update",
      collectionId: this.id(input.collectionId, "collectionId"),
      itemId: this.id(input.itemId, "itemId"),
      ...(this.optionalId(input.cmsLocaleId, "cmsLocaleId")
        ? { cmsLocaleId: this.optionalId(input.cmsLocaleId, "cmsLocaleId")! }
        : {}),
      fieldData,
    };
  }
  private normalizedPublish(input: JsonObject) {
    const itemIds = this.requiredIds(input.itemIds, "itemIds", 25);
    const cmsLocaleIds =
      input.cmsLocaleIds === undefined
        ? null
        : this.requiredIds(input.cmsLocaleIds, "cmsLocaleIds", 25);
    return {
      operation: "publish",
      collectionId: this.id(input.collectionId, "collectionId"),
      itemIds,
      ...(cmsLocaleIds ? { cmsLocaleIds } : {}),
    };
  }
  private fieldData(value: unknown): JsonObject {
    const object = this.object(value);
    const entries = Object.entries(object);
    if (entries.length < 1 || entries.length > 40)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow fieldData must contain 1 to 40 explicit fields.",
      );
    const result: JsonObject = {};
    for (const [key, item] of entries) {
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(key))
        throw new WebflowApiError(
          "provider_validation_error",
          "Webflow fieldData contains an invalid field key.",
        );
      result[key] = this.safe(item, 0);
    }
    if (Buffer.byteLength(JSON.stringify(result)) > 150000)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow fieldData exceeds 150 KB.",
      );
    return result;
  }
  private site(value: unknown) {
    const site = this.object(value);
    const locales = this.object(site.locales);
    return {
      id: this.text(site.id),
      workspaceId: this.text(site.workspaceId),
      displayName: this.bounded(this.text(site.displayName), 1000),
      shortName: this.text(site.shortName),
      createdOn: this.text(site.createdOn),
      lastPublished: this.text(site.lastPublished),
      lastUpdated: this.text(site.lastUpdated),
      timeZone: this.text(site.timeZone),
      customDomains: this.array(site.customDomains)
        .slice(0, 30)
        .map((domain) => {
          const item = this.object(domain);
          return {
            id: this.text(item.id),
            url: this.bounded(this.text(item.url), 2000),
            lastPublished: this.text(item.lastPublished),
          };
        }),
      locales: {
        primary: this.locale(locales.primary),
        secondary: this.array(locales.secondary)
          .slice(0, 30)
          .map((item) => this.locale(item)),
      },
      previewUrlPersisted: false,
    };
  }
  private collection(value: unknown, includeFields: boolean) {
    const collection = this.object(value);
    return {
      id: this.text(collection.id),
      displayName: this.bounded(this.text(collection.displayName), 1000),
      singularName: this.bounded(this.text(collection.singularName), 1000),
      slug: this.text(collection.slug),
      createdOn: this.text(collection.createdOn),
      lastUpdated: this.text(collection.lastUpdated),
      fields: includeFields
        ? this.array(collection.fields)
            .slice(0, 40)
            .map((field) => {
              const item = this.object(field);
              return {
                id: this.text(item.id),
                slug: this.text(item.slug),
                displayName: this.bounded(this.text(item.displayName), 1000),
                type: this.text(item.type),
                isRequired: item.isRequired === true,
                isEditable: item.isEditable !== false,
                metadata: this.safe(item.metadata, 0),
              };
            })
        : [],
    };
  }
  private item(value: unknown) {
    const item = this.object(value);
    return {
      id: this.text(item.id),
      cmsLocaleId: this.text(item.cmsLocaleId),
      createdOn: this.text(item.createdOn),
      lastUpdated: this.text(item.lastUpdated),
      lastPublished: this.text(item.lastPublished),
      isArchived: item.isArchived === true,
      isDraft: item.isDraft === true,
      fieldData: this.safe(item.fieldData, 0),
    };
  }
  private application(value: unknown) {
    const app = this.object(value);
    return {
      id: this.text(app.id),
      displayName: this.bounded(this.text(app.displayName), 1000),
      description: this.bounded(this.text(app.description), 2000),
      homepage: this.bounded(this.text(app.homepage), 2000),
    };
  }
  private locale(value: unknown) {
    const locale = this.object(value);
    return {
      id: this.text(locale.id),
      cmsLocaleId: this.text(locale.cmsLocaleId),
      enabled: locale.enabled === true,
      displayName: this.bounded(this.text(locale.displayName), 1000),
      tag: this.text(locale.tag),
      subdirectory: this.text(locale.subdirectory),
    };
  }
  private pagination(
    value: unknown,
    fallbackLimit: number,
    fallbackOffset: number,
  ) {
    const page = this.object(value);
    return {
      total: this.numeric(page.total),
      limit: this.numeric(page.limit) ?? fallbackLimit,
      offset: this.numeric(page.offset) ?? fallbackOffset,
    };
  }
  private safe(value: unknown, depth: number): unknown {
    if (depth > 5) return null;
    if (typeof value === "string") return this.bounded(value, 20000);
    if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    )
      return value;
    if (Array.isArray(value))
      return value.slice(0, 50).map((item) => this.safe(item, depth + 1));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value as JsonObject)
          .slice(0, 80)
          .map(([key, item]) => [
            key.slice(0, 200),
            this.safe(item, depth + 1),
          ]),
      );
    return null;
  }
  private digest(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
  private requiredIds(value: unknown, field: string, max: number) {
    if (!Array.isArray(value) || value.length < 1 || value.length > max)
      throw new WebflowApiError(
        "provider_validation_error",
        `Webflow ${field} is invalid.`,
      );
    const ids = value.map((item) => this.id(item, field));
    if (new Set(ids).size !== ids.length)
      throw new WebflowApiError(
        "provider_validation_error",
        `Webflow ${field} contains duplicates.`,
      );
    return ids;
  }
  private ids(value: unknown, max: number) {
    return this.array(value)
      .slice(0, max)
      .map((item) => this.text(item))
      .filter((item): item is string => !!item);
  }
  private scopeList(value: unknown) {
    return (this.text(value) ?? "")
      .split(/[ ,]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 100);
  }
  private id(value: unknown, field: string) {
    const id = this.text(value);
    if (!id || id.length > 500 || !/^[A-Za-z0-9._:-]+$/.test(id))
      throw new WebflowApiError(
        "provider_validation_error",
        `Webflow ${field} is invalid.`,
      );
    return id;
  }
  private optionalId(value: unknown, field: string) {
    return value === undefined || value === null || value === ""
      ? null
      : this.id(value, field);
  }
  private limit(value: unknown, fallback: number, max: number) {
    if (value === undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > max)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow maxResults is invalid.",
      );
    return number;
  }
  private offset(value: unknown) {
    if (value === undefined) return 0;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number > 100000)
      throw new WebflowApiError(
        "provider_validation_error",
        "Webflow offset is invalid.",
      );
    return number;
  }
  private segment(value: string) {
    return encodeURIComponent(value);
  }
  private bounded(value: string | null, max: number) {
    return value ? value.slice(0, max) : null;
  }
  private numeric(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  private text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }
  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private code(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
}
