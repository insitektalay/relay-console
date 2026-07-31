import {
  EventPlatformReadApiAdapter,
  type EventPlatformCredentials,
} from "../event-platform/event-platform-read-api.adapter";
export type BizzaboCredentials = EventPlatformCredentials;
export class BizzaboApiAdapter extends EventPlatformReadApiAdapter {
  constructor(requester: typeof fetch = fetch) {
    super(
      {
        slug: "bizzabo",
        name: "Bizzabo",
        apiOrigin: "https://api.bizzabo.com",
        authorization: "bearer",
        listPath: "/v1/events",
        detailPath: (eventId) => `/v1/events/${encodeURIComponent(eventId)}`,
        limitParameter: "size",
        listQuery: { page: "0" },
        itemContainers: ["content", "data", "events", "items"],
      },
      requester,
    );
  }
}
