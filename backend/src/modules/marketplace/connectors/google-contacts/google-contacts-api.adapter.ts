import { safeConnectorFetch } from "../safe-connector-fetch";
import { createHash } from "node:crypto";
import type { MarketplaceConnectorSafeErrorCode } from "../types";
type JsonObject = Record<string, unknown>;
export class GoogleContactsApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GoogleContactsApiAdapter {
  private readonly origin = "https://people.googleapis.com/v1";
  private readonly fields =
    "names,emailAddresses,phoneNumbers,organizations,metadata";
  async health(token: string) {
    await this.request(token, "GET", `${this.origin}/people/me/connections`, {
      pageSize: "1",
      personFields: "metadata",
      sources: "READ_SOURCE_TYPE_CONTACT",
    });
  }
  async listContacts(token: string) {
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/people/me/connections`,
      {
        pageSize: "50",
        sortOrder: "LAST_MODIFIED_DESCENDING",
        personFields: this.fields,
        sources: "READ_SOURCE_TYPE_CONTACT",
      },
    );
    const contacts = this.array(value.connections)
      .slice(0, 50)
      .map((v) => this.person(v));
    return {
      connections: contacts,
      count: contacts.length,
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken)),
      nextPageFollowed: false,
      providerRequestCount: 1,
    };
  }
  async getContact(token: string, input: JsonObject) {
    const resource = this.resource(input.resourceName);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/${resource}`,
      { personFields: this.fields, sources: "READ_SOURCE_TYPE_CONTACT" },
    );
    return { contact: this.person(value), providerRequestCount: 1 };
  }
  prepareUpdate(input: JsonObject) {
    const operation =
      input.operation === "create" || input.operation === "patch"
        ? input.operation
        : null;
    if (!operation)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "operation must be create or patch.",
      );
    const update = this.writeBody(input, operation === "patch");
    const change = {
      operation,
      ...(operation === "patch"
        ? { resourceName: this.resource(input.resourceName) }
        : {}),
      fields: update.body,
      updateMask: update.mask,
    };
    return {
      change,
      digest: createHash("sha256").update(JSON.stringify(change)).digest("hex"),
      providerRequestCount: 0,
    };
  }
  async createContact(token: string, input: JsonObject) {
    const update = this.writeBody(input, false);
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/people:createContact`,
      { personFields: this.fields, sources: "READ_SOURCE_TYPE_CONTACT" },
      update.body,
    );
    return {
      operation: "create_contact",
      contact: this.person(value),
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 1,
    };
  }
  async updateContact(token: string, input: JsonObject) {
    const resource = this.resource(input.resourceName);
    const current = await this.request(
      token,
      "GET",
      `${this.origin}/${resource}`,
      { personFields: this.fields, sources: "READ_SOURCE_TYPE_CONTACT" },
    );
    if (!current.etag || !this.object(current.metadata).sources)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Latest contact source metadata and ETag are required.",
      );
    const update = this.writeBody(input, true),
      body = { ...current, ...update.body };
    const value = await this.request(
      token,
      "PATCH",
      `${this.origin}/${resource}:updateContact`,
      {
        updatePersonFields: update.mask,
        personFields: this.fields,
        sources: "READ_SOURCE_TYPE_CONTACT",
      },
      body,
    );
    return {
      operation: "update_contact",
      contact: this.person(value),
      latestSourceEtagPreflight: true,
      idempotencyKey: this.key(input.idempotencyKey),
      providerRequestCount: 2,
    };
  }
  private writeBody(input: JsonObject, patch: boolean) {
    const body: JsonObject = {},
      masks: string[] = [];
    if (input.givenName != null || input.familyName != null) {
      const givenName = this.optionalText(input.givenName, 256),
        familyName = this.optionalText(input.familyName, 256);
      if (!givenName && !familyName)
        throw new GoogleContactsApiError(
          "provider_validation_error",
          "A name update cannot be empty.",
        );
      body.names = [
        {
          ...(givenName ? { givenName } : {}),
          ...(familyName ? { familyName } : {}),
        },
      ];
      masks.push("names");
    }
    const emails = this.strings(input.emailAddresses, 5, 320),
      phones = this.strings(input.phoneNumbers, 5, 64),
      organizations = this.organizations(input.organizations);
    if (emails) {
      body.emailAddresses = emails.map((value) => ({ value }));
      masks.push("emailAddresses");
    }
    if (phones) {
      body.phoneNumbers = phones.map((value) => ({ value }));
      masks.push("phoneNumbers");
    }
    if (organizations) {
      body.organizations = organizations;
      masks.push("organizations");
    }
    if (!masks.length)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Contact write requires an allowlisted field.",
      );
    if (!patch && !body.names)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Contact creation requires a name.",
      );
    return { body, mask: masks.join(",") };
  }
  private async request(
    token: string,
    method: string,
    base: string,
    query: Record<string, string>,
    body?: JsonObject,
  ) {
    if (!token || token.length > 8000)
      throw new GoogleContactsApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
    const url = new URL(base);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GoogleContactsApiError(
        "provider_unavailable",
        "Google People API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 2097152)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Google Contacts response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GoogleContactsApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google People API rejected the bounded request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Google People API returned invalid JSON.",
      );
    }
  }
  private person(v: unknown) {
    const r = this.object(v);
    return {
      resourceName: this.text(r.resourceName, 512),
      etag: this.text(r.etag, 512),
      names: this.compact(
        r.names,
        ["displayName", "givenName", "familyName"],
        1,
      ),
      emailAddresses: this.compact(r.emailAddresses, ["value", "type"], 5),
      phoneNumbers: this.compact(r.phoneNumbers, ["value", "type"], 5),
      organizations: this.compact(
        r.organizations,
        ["name", "title", "department"],
        3,
      ),
      broadPersonalFieldsReturned: false,
      directoryProfileReturned: false,
      otherContactReturned: false,
    };
  }
  private compact(v: unknown, fields: string[], limit: number) {
    return this.array(v)
      .slice(0, limit)
      .map((item) => {
        const source = this.object(item),
          result: JsonObject = {};
        fields.forEach((field) => {
          result[field] = this.text(
            source[field],
            field === "value" ? 320 : 256,
          );
        });
        return result;
      });
  }
  private object(v: unknown): JsonObject {
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as JsonObject)
      : {};
  }
  private array(v: unknown) {
    return Array.isArray(v) ? v : [];
  }
  private text(v: unknown, max = 1024) {
    return typeof v === "string" && v.length <= max ? v : null;
  }
  private resource(v: unknown) {
    const r = this.text(v, 512);
    if (!r || !/^people\/[A-Za-z0-9_-]+$/.test(r))
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "resourceName is invalid.",
      );
    return r;
  }
  private optionalText(v: unknown, max: number) {
    if (v == null || v === "") return null;
    if (typeof v !== "string" || !v.trim() || v.trim().length > max)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Text input is invalid.",
      );
    return v.trim();
  }
  private strings(v: unknown, count: number, length: number) {
    if (v == null) return null;
    if (!Array.isArray(v) || v.length > count)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "Contact field count exceeds Relay bounds.",
      );
    return v.map((item) => {
      const value = this.optionalText(item, length);
      if (!value)
        throw new GoogleContactsApiError(
          "provider_validation_error",
          "Contact field is invalid.",
        );
      return value;
    });
  }
  private organizations(v: unknown) {
    if (v == null) return null;
    if (!Array.isArray(v) || v.length > 3)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "At most three organizations are allowed.",
      );
    return v.map((item) => {
      const source = this.object(item),
        name = this.optionalText(source.name, 256),
        title = this.optionalText(source.title, 256);
      if (!name)
        throw new GoogleContactsApiError(
          "provider_validation_error",
          "Organization name is required.",
        );
      return { name, ...(title ? { title } : {}) };
    });
  }
  private key(v: unknown) {
    const r = this.text(v, 200);
    if (!r || r.length < 8)
      throw new GoogleContactsApiError(
        "provider_validation_error",
        "idempotencyKey is invalid.",
      );
    return r;
  }
}
