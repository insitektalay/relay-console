import {
  EventPlatformApiError,
  EventPlatformReadApiAdapter,
  type EventPlatformCredentials,
} from "../event-platform/event-platform-read-api.adapter";

export type EventzillaCredentials = EventPlatformCredentials;

export class EventzillaApiAdapter extends EventPlatformReadApiAdapter {
  constructor(requester: typeof fetch = fetch) {
    super(
      {
        slug: "eventzilla",
        name: "Eventzilla",
        apiOrigin: "https://www.eventzillaapi.net",
        authorization: "x-api-key",
        listPath: "/api/v2/events",
        detailPath: (eventId) =>
          `/api/v2/events/${encodeURIComponent(eventId)}`,
        limitParameter: "limit",
        listQuery: { offset: "0" },
        itemContainers: ["events"],
      },
      requester,
    );
  }

  override async getEvent(
    credentials: EventzillaCredentials,
    input: { eventId: string },
  ) {
    if (!/^[1-9][0-9]{0,19}$/.test(input.eventId?.trim())) {
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Eventzilla event ID must be numeric.",
      );
    }
    return super.getEvent(credentials, { eventId: input.eventId.trim() });
  }
}
