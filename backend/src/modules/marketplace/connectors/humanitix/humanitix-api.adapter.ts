import {
  EventPlatformApiError,
  EventPlatformReadApiAdapter,
  type EventPlatformCredentials,
} from "../event-platform/event-platform-read-api.adapter";

export type HumanitixCredentials = EventPlatformCredentials;

export class HumanitixApiAdapter extends EventPlatformReadApiAdapter {
  constructor(requester: typeof fetch = fetch) {
    super(
      {
        slug: "humanitix",
        name: "Humanitix",
        apiOrigin: "https://api.humanitix.com",
        authorization: "x-api-key",
        listPath: "/v1/events",
        detailPath: (eventId) => `/v1/events/${encodeURIComponent(eventId)}`,
        limitParameter: "pageSize",
        listQuery: { page: "1" },
        itemContainers: ["events"],
      },
      requester,
    );
  }

  override async getEvent(
    credentials: HumanitixCredentials,
    input: { eventId: string },
  ) {
    if (!/^[A-Fa-f0-9]{24}$/.test(input.eventId?.trim()))
      throw new EventPlatformApiError(
        "provider_validation_error",
        "Humanitix event ID must be a 24-character hexadecimal identifier.",
      );
    return super.getEvent(credentials, { eventId: input.eventId.trim() });
  }
}
