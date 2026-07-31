import {
  EventPlatformReadApiAdapter,
  type EventPlatformCredentials,
} from "../event-platform/event-platform-read-api.adapter";

export type GoldcastCredentials = EventPlatformCredentials;

export class GoldcastApiAdapter extends EventPlatformReadApiAdapter {
  constructor(requester: typeof fetch = fetch) {
    super(
      {
        slug: "goldcast",
        name: "Goldcast",
        apiOrigin: "https://customapi.goldcast.io",
        authorization: "bearer",
        listPath: "/event/",
        detailPath: (eventId) => `/event/${encodeURIComponent(eventId)}/`,
        limitParameter: "page_size",
        itemContainers: ["results", "data", "events"],
      },
      requester,
    );
  }
}
