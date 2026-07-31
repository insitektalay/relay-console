import {
  EventPlatformApiError,
  EventPlatformReadApiAdapter,
} from "../event-platform/event-platform-read-api.adapter";

export type PretixCredentials = { apiToken: string; organizer: string };

/** Hosted pretix boundary: one organizer, event metadata only, no order data. */
export class PretixApiAdapter {
  constructor(private readonly requester: typeof fetch = fetch) {}

  async health(credentials: PretixCredentials) {
    await this.adapter(credentials).listEvents(this.token(credentials), {
      limit: 1,
    });
    return { apiOrigin: "https://pretix.eu", organizer: credentials.organizer };
  }

  async listEvents(
    credentials: PretixCredentials,
    input: { limit?: number } = {},
  ) {
    return this.adapter(credentials).listEvents(this.token(credentials), input);
  }

  async getEvent(credentials: PretixCredentials, input: { eventId: string }) {
    return this.adapter(credentials).getEvent(this.token(credentials), input);
  }

  private adapter(credentials: PretixCredentials) {
    const organizer = this.identifier(credentials.organizer, "organizer slug");
    return new EventPlatformReadApiAdapter(
      {
        slug: "pretix",
        name: "pretix",
        apiOrigin: "https://pretix.eu",
        authorization: "token",
        listPath: `/api/v1/organizers/${organizer}/events/`,
        detailPath: (eventId) =>
          `/api/v1/organizers/${organizer}/events/${encodeURIComponent(eventId)}/`,
        limitParameter: "page_size",
        itemContainers: ["results"],
      },
      this.requester,
    );
  }

  private token(credentials: PretixCredentials) {
    return { apiToken: credentials.apiToken };
  }

  private identifier(value: unknown, label: string) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(text))
      throw new EventPlatformApiError(
        "provider_validation_error",
        `pretix ${label} is invalid.`,
      );
    return text;
  }
}
