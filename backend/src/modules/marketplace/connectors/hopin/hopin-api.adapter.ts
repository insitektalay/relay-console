import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type Requester = (url: string | URL, init: RequestInit) => Promise<Response>;

export type HopinCredentials = { accessToken: string; organizationId: string };

export class HopinApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class HopinApiAdapter {
  private readonly apiOrigin = "https://api.events.ringcentral.com";
  private readonly maxResponseBytes = 512 * 1024;
  constructor(private readonly requester: Requester = fetch) {}

  async health(credentials: HopinCredentials) {
    const organization = this.organization(
      await this.request(
        credentials,
        `/v1/organizations/${encodeURIComponent(this.id(credentials.organizationId, "organizationId"))}`,
      ),
    );
    if (organization.organizationId !== credentials.organizationId)
      throw this.invalid(
        "RingCentral Events returned a different Organization than configured",
      );
    return {
      organizationId: organization.organizationId,
      organizationName: organization.name,
      apiOrigin: this.apiOrigin,
    };
  }

  async getOrganization(credentials: HopinCredentials) {
    const identity = await this.health(credentials);
    return {
      name: identity.organizationName,
      verified: true,
      organizationBindingVerified: true,
    };
  }

  async listOrganizationEvents(
    credentials: HopinCredentials,
    limitInput?: unknown,
  ) {
    const limit = this.limit(limitInput);
    const body = this.collection(
      await this.request(
        credentials,
        `/v1/organizations/${encodeURIComponent(credentials.organizationId)}/events?page=1&perPage=${limit}`,
      ),
      "event",
    );
    return {
      events: body.data.map((value) => this.event(value)),
      truncated: body.count > limit,
    };
  }

  async getEvent(credentials: HopinCredentials, eventIdInput: unknown) {
    const eventId = this.id(eventIdInput, "eventId");
    await this.requireFirstPageEvent(credentials, eventId);
    const event = this.event(
      await this.request(
        credentials,
        `/v1/events/${encodeURIComponent(eventId)}`,
      ),
    );
    if (event.eventId !== eventId)
      throw this.invalid(
        "RingCentral Events returned a different Event than requested",
      );
    return event;
  }

  async listEventScheduleItems(
    credentials: HopinCredentials,
    eventIdInput: unknown,
    limitInput?: unknown,
  ) {
    const eventId = this.id(eventIdInput, "eventId");
    await this.requireFirstPageEvent(credentials, eventId);
    const limit = this.limit(limitInput);
    const body = this.collection(
      await this.request(
        credentials,
        `/v1/events/${encodeURIComponent(eventId)}/scheduleItems?page=1&perPage=${limit}`,
      ),
      "scheduleItem",
    );
    return {
      scheduleItems: body.data.map((value) => this.scheduleItem(value)),
      truncated: body.count > limit,
    };
  }

  private async requireFirstPageEvent(
    credentials: HopinCredentials,
    eventId: string,
  ) {
    const body = this.collection(
      await this.request(
        credentials,
        `/v1/organizations/${encodeURIComponent(credentials.organizationId)}/events?page=1&perPage=10`,
      ),
      "event",
    );
    if (!body.data.some((value) => this.resourceId(value, "event") === eventId))
      throw new HopinApiError(
        "provider_validation_error",
        "Event is not on the bound Organization's first bounded page",
        403,
      );
  }

  private async request(credentials: HopinCredentials, path: string) {
    const token = credentials.accessToken.trim();
    const organizationId = this.id(
      credentials.organizationId,
      "organizationId",
    );
    if (
      !token ||
      token.length > 16_000 ||
      /[\r\n]/.test(token) ||
      !organizationId
    )
      throw new HopinApiError(
        "credential_missing",
        "A valid RingCentral Events token and Organization ID are required",
        401,
      );
    let response: Response;
    try {
      response = await this.requester(`${this.apiOrigin}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "RelayConsole-RingCentral-Events/1.0",
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HopinApiError(
        "provider_unavailable",
        "RingCentral Events could not be reached",
        502,
      );
    }
    const body = await this.safeBody(response);
    if (!response.ok)
      throw new HopinApiError(
        this.safeCode(response.status),
        `RingCentral Events returned HTTP ${response.status}`,
        response.status,
      );
    return body;
  }

  private organization(value: unknown) {
    const resource = this.resource(value, "organization");
    const organizationId = this.resourceId(resource, "organization");
    const name = this.text(this.object(resource.attributes).name, 300);
    if (!name)
      throw this.invalid(
        "RingCentral Events returned an incomplete Organization",
      );
    return { organizationId, name };
  }

  private event(value: unknown) {
    const resource = this.resource(value, "event");
    const attributes = this.object(resource.attributes);
    const eventId = this.resourceId(resource, "event");
    const name = this.text(attributes.name, 500);
    const timeStart = this.dateTime(attributes.timeStart, "timeStart");
    const timeEnd = this.dateTime(attributes.timeEnd, "timeEnd");
    if (!name)
      throw this.invalid("RingCentral Events returned an incomplete Event");
    return {
      eventId,
      name,
      description: this.text(attributes.description, 2_000),
      published: attributes.published === true,
      status: this.text(attributes.status, 100),
      timeStart,
      timeEnd,
      timezone: this.timezone(attributes.timezone),
      eventType: this.text(attributes.type, 100),
      venueType: this.text(attributes.venueType, 100),
      slug: this.slug(attributes.slug),
    };
  }

  private scheduleItem(value: unknown) {
    const resource = this.resource(value, "scheduleItem");
    const attributes = this.object(resource.attributes);
    const scheduleItemId = this.resourceId(resource, "scheduleItem");
    const name = this.text(attributes.name, 500);
    const timeStart = this.dateTime(attributes.timeStart, "timeStart");
    const timeEnd = this.dateTime(attributes.timeEnd, "timeEnd");
    if (!name)
      throw this.invalid(
        "RingCentral Events returned an incomplete Schedule Item",
      );
    return {
      scheduleItemId,
      name,
      description: this.text(attributes.description, 2_000),
      area: this.text(attributes.area, 100),
      areaName: this.text(attributes.areaName, 300),
      timeStart,
      timeEnd,
    };
  }

  private collection(value: unknown, type: string) {
    const object = this.object(value);
    if (!Array.isArray(object.data))
      throw this.invalid("RingCentral Events returned an invalid collection");
    const data = object.data.slice(0, 10);
    for (const resource of data) this.resource(resource, type);
    const countValue = this.object(object.meta).count;
    const count =
      typeof countValue === "number" &&
      Number.isFinite(countValue) &&
      countValue >= 0
        ? Math.trunc(countValue)
        : data.length;
    return { data, count };
  }

  private resource(value: unknown, type: string) {
    const root = this.object(value);
    const resource = this.object(root.data ?? value);
    if (resource.type !== type)
      throw this.invalid(
        `RingCentral Events returned an invalid ${type} resource`,
      );
    this.resourceId(resource, type);
    return resource;
  }
  private resourceId(value: unknown, label: string) {
    const resource = this.object(value);
    return this.id(
      resource.id ?? this.object(resource.attributes).id,
      `${label} ID`,
    );
  }
  private id(value: unknown, label: string) {
    const text = this.text(value, 128);
    if (!text || !/^[A-Za-z0-9_-]+$/.test(text))
      throw this.invalid(`${label} is invalid`);
    return text;
  }
  private dateTime(value: unknown, field: string) {
    const text = this.text(value, 64);
    if (
      !text ||
      Number.isNaN(Date.parse(text)) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(text)
    )
      throw this.invalid(`${field} must be an ISO 8601 date-time with offset`);
    return text;
  }
  private timezone(value: unknown) {
    const text = this.text(value, 100);
    return text && /^[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(text)
      ? text
      : null;
  }
  private slug(value: unknown) {
    const text = this.text(value, 200);
    return text && /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
  }
  private limit(value: unknown) {
    if (value == null) return 10;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 10
    )
      throw this.invalid("limit must be an integer from 1 through 10");
    return value;
  }
  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }
  private text(value: unknown, maxLength: number) {
    return typeof value === "string" && value.trim()
      ? value.trim().slice(0, maxLength)
      : null;
  }

  private async safeBody(response: Response) {
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > this.maxResponseBytes)
      throw this.invalid(
        "RingCentral Events response exceeded the allowed size",
      );
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      throw new HopinApiError(
        "provider_unavailable",
        "RingCentral Events response could not be read",
        502,
      );
    }
    if (bytes.byteLength > this.maxResponseBytes)
      throw this.invalid(
        "RingCentral Events response exceeded the allowed size",
      );
    if (!bytes.byteLength) return {};
    try {
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      if (response.ok)
        throw this.invalid("RingCentral Events returned invalid JSON");
      return {};
    }
  }
  private safeCode(status: number): MarketplaceConnectorSafeErrorCode {
    if (status === 401) return "credential_missing";
    if (status === 403) return "insufficient_scope";
    if (status === 404) return "provider_validation_error";
    if (status === 429) return "provider_rate_limited";
    if (status >= 500) return "provider_unavailable";
    return "provider_validation_error";
  }
  private invalid(message: string) {
    return new HopinApiError("provider_validation_error", message, 400);
  }
}
