import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;

export type HigherLogicCredentials = {
  region: "us" | "ca" | string;
  contactKey: string;
  iamKey: string;
  apiPassword: string;
};

export class HigherLogicApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class HigherLogicApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(credentials: HigherLogicCredentials) {
    const actor = await this.getCurrentContact(credentials);
    return { credentialsValid: true, actor: actor.contact };
  }

  async getCurrentContact(credentials: HigherLogicCredentials) {
    const body = await this.send(
      credentials,
      "Contacts/GetWhoAmI?includeSecurityGroups=false",
    );
    const contact = this.contact(
      this.objectOrNull(this.value(body, "Contact", "contact")) ?? body,
    );
    const expected = this.id(credentials.contactKey, "ContactKey", true);
    if (contact.id !== expected)
      throw new HigherLogicApiError(
        "policy_blocked",
        "Higher Logic credentials do not represent the exactly configured contact.",
        403,
      );
    return { contact };
  }

  async listMyCommunities(
    credentials: HigherLogicCredentials,
    input: JsonObject,
  ) {
    const body = await this.send(
      credentials,
      "Communities/GetMyCommunities?includeStatistics=true&includeHiddenCommunities=false",
    );
    return this.collection(body, input, (value) => this.community(value));
  }

  async listViewableCommunities(
    credentials: HigherLogicCredentials,
    input: JsonObject,
  ) {
    const body = await this.send(
      credentials,
      "Communities/GetViewableCommunities?includeStatistics=true",
    );
    return this.collection(body, input, (value) => this.community(value));
  }

  async listContributableCommunities(
    credentials: HigherLogicCredentials,
    input: JsonObject,
  ) {
    const body = await this.send(
      credentials,
      "Communities/GetCommunitiesCanContribute?includeStatistics=true",
    );
    return this.collection(body, input, (value) => this.community(value));
  }

  async listEligibleDiscussions(
    credentials: HigherLogicCredentials,
    input: JsonObject,
  ) {
    const body = await this.send(
      credentials,
      "Discussions/GetEligibleDiscussions",
    );
    return this.collection(body, input, (value) => this.discussion(value));
  }

  async listUpcomingEvents(
    credentials: HigherLogicCredentials,
    input: JsonObject,
  ) {
    const maxResults = this.maxResults(input);
    const query = new URLSearchParams({ maxRecords: String(maxResults) });
    const body = await this.send(credentials, `Events/GetUpcoming?${query}`);
    return this.collection(body, { maxResults }, (value) => this.event(value));
  }

  private async send(
    credentials: HigherLogicCredentials,
    path: string,
  ): Promise<unknown> {
    const endpoint = this.endpoint(credentials.region);
    this.id(credentials.contactKey, "ContactKey", true);
    const iamKey = credentials.iamKey.trim();
    const apiPassword = credentials.apiPassword.trim();
    if (
      !iamKey ||
      iamKey.length > 4_096 ||
      !apiPassword ||
      apiPassword.length > 4_096
    )
      throw new HigherLogicApiError(
        "credential_missing",
        "Higher Logic IAM credentials are missing or invalid.",
      );
    const url = new URL(path, endpoint);
    if (
      url.origin !== new URL(endpoint).origin ||
      !url.pathname.startsWith("/api/v2.0/")
    )
      throw new HigherLogicApiError(
        "policy_blocked",
        "Higher Logic request left the fixed regional API boundary.",
        403,
      );
    let response: Response;
    try {
      response = await this.request(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          HLIAMKey: iamKey,
          HLPassword: apiPassword,
        },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new HigherLogicApiError(
        "provider_unavailable",
        "Higher Logic is temporarily unavailable.",
      );
    }
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 2_000_000)
      throw new HigherLogicApiError(
        "provider_validation_error",
        "Higher Logic response exceeded the safe size limit.",
      );
    let parsed: unknown = {};
    try {
      parsed = raw.length ? JSON.parse(raw.toString("utf8")) : {};
    } catch {
      throw new HigherLogicApiError(
        "provider_validation_error",
        "Higher Logic returned an invalid response.",
      );
    }
    if (!response.ok)
      throw new HigherLogicApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Higher Logic API request failed.",
        response.status,
        { retryAfter: response.headers.get("retry-after") },
      );
    return parsed;
  }

  private endpoint(region: string) {
    const normalized = region.trim().toLowerCase();
    if (normalized === "us") return "https://api.higherlogic.com/api/v2.0/";
    if (normalized === "ca") return "https://api.onlinecommunity.ca/api/v2.0/";
    throw new HigherLogicApiError(
      "credential_missing",
      "Higher Logic region must be exactly us or ca.",
    );
  }

  private collection<T>(
    body: unknown,
    input: JsonObject,
    map: (value: unknown) => T,
  ) {
    const maxResults = this.maxResults(input);
    const values = this.collectionValues(body);
    return {
      items: values.slice(0, maxResults).map(map),
      returned: Math.min(values.length, maxResults),
      truncated: values.length > maxResults,
    };
  }

  private collectionValues(body: unknown): unknown[] {
    if (Array.isArray(body)) return body;
    const item = this.object(body);
    for (const key of [
      "Items",
      "items",
      "Results",
      "results",
      "Communities",
      "communities",
      "Discussions",
      "discussions",
      "Events",
      "events",
    ]) {
      const value = item[key];
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  private contact(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(this.value(item, "ContactKey", "contactKey")),
      displayName: this.scalar(this.value(item, "DisplayName", "displayName")),
      memberStatus: this.scalar(
        this.value(item, "MemberStatus", "memberStatus", "Status", "status"),
      ),
      contactStatusCode: this.scalar(
        this.value(item, "ContactStatusCode", "contactStatusCode"),
      ),
      administrator: this.boolean(
        this.value(
          item,
          "IsAdmin",
          "isAdmin",
          "Administrator",
          "administrator",
        ),
      ),
    };
  }

  private community(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(this.value(item, "CommunityKey", "communityKey")),
      name: this.scalar(
        this.value(item, "CommunityName", "communityName", "Name", "name"),
      ),
      type: this.scalar(
        this.value(item, "CommunityType", "communityType", "Type", "type"),
      ),
      memberCount: this.integerScalar(
        this.value(item, "MemberCount", "memberCount", "MembersCount"),
      ),
      discussionCount: this.integerScalar(
        this.value(item, "DiscussionCount", "discussionCount"),
      ),
      joined: this.boolean(
        this.value(item, "IsMember", "isMember", "Joined", "joined"),
      ),
      canContribute: this.boolean(
        this.value(item, "CanContribute", "canContribute"),
      ),
    };
  }

  private discussion(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(this.value(item, "DiscussionKey", "discussionKey")),
      name: this.scalar(
        this.value(item, "DiscussionName", "discussionName", "Name", "name"),
      ),
      communityId: this.scalar(
        this.value(item, "CommunityKey", "communityKey"),
      ),
      subscribed: this.boolean(
        this.value(
          item,
          "IsSubscribed",
          "isSubscribed",
          "Subscribed",
          "subscribed",
        ),
      ),
      active: this.boolean(this.value(item, "IsActive", "isActive")),
    };
  }

  private event(value: unknown) {
    const item = this.object(value);
    return {
      id: this.scalar(
        this.value(
          item,
          "EventKey",
          "eventKey",
          "CalendarEventKey",
          "calendarEventKey",
        ),
      ),
      name: this.scalar(
        this.value(item, "EventName", "eventName", "Name", "name"),
      ),
      eventType: this.scalar(
        this.value(
          item,
          "EventTypeName",
          "eventTypeName",
          "EventType",
          "eventType",
        ),
      ),
      startsAt: this.scalar(
        this.value(
          item,
          "StartDateTime",
          "startDateTime",
          "StartDate",
          "startDate",
        ),
      ),
      endsAt: this.scalar(
        this.value(item, "EndDateTime", "endDateTime", "EndDate", "endDate"),
      ),
      allDay: this.boolean(this.value(item, "IsAllDay", "isAllDay", "AllDay")),
      communityId: this.scalar(
        this.value(item, "CommunityKey", "communityKey"),
      ),
    };
  }

  private id(value: unknown, field: string, credential = false) {
    if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(value))
      throw new HigherLogicApiError(
        credential ? "credential_missing" : "provider_validation_error",
        `Higher Logic ${field} is invalid.`,
      );
    return value;
  }

  private maxResults(input: JsonObject) {
    const value = input.maxResults;
    if (value == null) return 25;
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isSafeInteger(number) || number < 1 || number > 25)
      throw new HigherLogicApiError(
        "provider_validation_error",
        "Higher Logic maxResults is invalid.",
      );
    return number;
  }

  private value(item: unknown, ...keys: string[]): unknown {
    const object = this.object(item);
    for (const key of keys) if (object[key] != null) return object[key];
    return null;
  }

  private object(value: unknown): JsonObject {
    return this.objectOrNull(value) ?? {};
  }

  private objectOrNull(value: unknown): JsonObject | null {
    return value != null && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  }

  private scalar(value: unknown): string | null {
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : null;
  }

  private integerScalar(value: unknown): number | null {
    const number = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }

  private boolean(value: unknown): boolean | null {
    return typeof value === "boolean"
      ? value
      : value === 1 || value === "1" || value === "true"
        ? true
        : value === 0 || value === "0" || value === "false"
          ? false
          : null;
  }
}
