import {
  EventPlatformApiError,
  EventPlatformReadApiAdapter,
  type EventPlatformCredentials,
} from "../event-platform/event-platform-read-api.adapter";

export type TicketTailorCredentials = EventPlatformCredentials;

export class TicketTailorApiAdapter extends EventPlatformReadApiAdapter {
  constructor(requester: typeof fetch = fetch) {
    super(
      {
        slug: "ticket-tailor",
        name: "Ticket Tailor",
        apiOrigin: "https://api.tickettailor.com",
        authorization: "basic_api_key",
        listPath: "/v1/events",
        detailPath: (eventId) => `/v1/events/${encodeURIComponent(eventId)}`,
        limitParameter: "limit",
        itemContainers: ["data"],
      },
      requester,
    );
  }

  override async getEvent(
    credentials: TicketTailorCredentials,
    input: { eventId: string },
  ) {
    if (!/^ev_[A-Za-z0-9][A-Za-z0-9_-]{0,123}$/.test(input.eventId?.trim())) {
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Ticket Tailor event ID is invalid.",
      );
    }
    return super.getEvent(credentials, { eventId: input.eventId.trim() });
  }
}
