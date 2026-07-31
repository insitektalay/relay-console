import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CalendlyApiAdapter, CalendlyApiError } from "./calendly-api.adapter";
import { CALENDLY_CONNECTOR_MANIFEST } from "./calendly.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const credentials = {
  accessToken: "access",
  userUri: "https://api.calendly.com/users/USER_123",
  organizationUri: "https://api.calendly.com/organizations/ORG_123",
};

describe("Calendly Marketplace connector", () => {
  it("registers exact OAuth scopes, PKCE and rotating refresh support", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("calendly")).toBe(CALENDLY_CONNECTOR_MANIFEST);
    expect(CALENDLY_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://auth.calendly.com/oauth/authorize",
      tokenUrl: "https://auth.calendly.com/oauth/token",
      requiredScopes: [
        "users:read",
        "event_types:read",
        "scheduled_events:read",
      ],
      pkce: true,
      supportsRefresh: true,
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(CALENDLY_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      CALENDLY_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
    expect(
      CALENDLY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions,
    ).toHaveLength(3);
  });

  it("pins list requests to the exact user, active state and fourteen-day window", async () => {
    const requests: string[] = [];
    const adapter = new CalendlyApiAdapter(async (url) => {
      requests.push(String(url));
      return response({ collection: [] });
    });
    await adapter.listEventTypes(credentials, { limit: 10 });
    await adapter.listScheduledEvents(
      credentials,
      { limit: 12 },
      new Date("2026-07-17T09:00:00.000Z"),
    );
    expect(requests[0]).toContain(
      "user=https%3A%2F%2Fapi.calendly.com%2Fusers%2FUSER_123",
    );
    expect(requests[0]).toContain("active=true");
    expect(requests[0]).toContain("count=10");
    expect(requests[1]).toContain("status=active");
    expect(requests[1]).toContain("count=12");
    expect(requests[1]).toContain("2026-07-31T09%3A00%3A00.000Z");
  });

  it("redacts invitee, location, conferencing and tracking content", async () => {
    const adapter = new CalendlyApiAdapter(async () =>
      response({
        resource: {
          uri: "https://api.calendly.com/scheduled_events/EVENT_123",
          name: "Planning",
          status: "active",
          start_time: "2026-07-18T09:00:00Z",
          end_time: "2026-07-18T09:30:00Z",
          event_type: "https://api.calendly.com/event_types/TYPE_123",
          invitees_counter: { total: 2, active: 1, limit: 10 },
          event_memberships: [
            { user: "private", user_email: "private@example.com" },
          ],
          location: { location: "Private room" },
          calendar_event: { external_id: "private" },
          description: "private notes",
        },
      }),
    );
    const result = await adapter.getScheduledEvent(credentials, {
      scheduledEventId: "EVENT_123",
    });
    expect(result.scheduledEvent).toMatchObject({
      scheduledEventId: "EVENT_123",
      eventTypeId: "TYPE_123",
      eventMembershipCount: 1,
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "private@example.com",
      "Private room",
      "private notes",
      "calendar_event",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects unsafe identity bindings and scheduled-event IDs", async () => {
    const adapter = new CalendlyApiAdapter(async () => response({}));
    await expect(
      adapter.listEventTypes({
        ...credentials,
        userUri: "https://evil.example/users/USER_123",
      }),
    ).rejects.toMatchObject<Partial<CalendlyApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.getScheduledEvent(credentials, {
        scheduledEventId: "../oauth/token",
      }),
    ).rejects.toMatchObject<Partial<CalendlyApiError>>({
      code: "provider_validation_error",
    });
  });
});
