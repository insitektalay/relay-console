import { MarketplaceConnectorRegistry } from "../connector-registry";
import { CalComApiAdapter, CalComApiError } from "./cal-com-api.adapter";
import { CAL_COM_CONNECTOR_MANIFEST } from "./cal-com.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const credentials = {
  accessToken: "access",
  userId: "123",
  username: "relay-user",
};

describe("Cal.com Marketplace connector", () => {
  it("registers the current reviewed OAuth flow and exact read scopes", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("cal-com")).toBe(CAL_COM_CONNECTOR_MANIFEST);
    expect(CAL_COM_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.cal.com/auth/oauth2/authorize",
      tokenUrl: "https://api.cal.com/v2/auth/oauth2/token",
      requiredScopes: ["PROFILE_READ", "EVENT_TYPE_READ", "BOOKING_READ"],
      supportsRefresh: true,
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(CAL_COM_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      CAL_COM_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins booking lists to upcoming page one and the requested bound", async () => {
    let requestUrl = "";
    let requestHeaders = new Headers();
    const adapter = new CalComApiAdapter(async (url, init) => {
      requestUrl = String(url);
      requestHeaders = new Headers(init.headers);
      return response({
        status: "success",
        data: [],
        pagination: { hasMore: true },
      });
    });
    await adapter.listBookings(credentials, { limit: 12 });
    expect(requestUrl).toContain("status=upcoming");
    expect(requestUrl).toContain("limit=12");
    expect(requestUrl).not.toContain("cursor=");
    expect(requestHeaders.get("cal-api-version")).toBe("2026-05-01");
  });

  it("redacts people, locations, conferencing, answers and metadata", async () => {
    const adapter = new CalComApiAdapter(async () =>
      response({
        status: "success",
        data: {
          id: 123,
          uid: "booking_uid_123",
          title: "Planning",
          status: "accepted",
          start: "2026-07-18T09:00:00Z",
          end: "2026-07-18T09:30:00Z",
          duration: 30,
          eventTypeId: 50,
          attendees: [{ email: "private@example.com", name: "Private" }],
          location: "Private room",
          meetingUrl: "https://private.example/meeting",
          bookingFieldsResponses: { secret: "answer" },
          metadata: { private: true },
        },
      }),
    );
    const result = await adapter.getBooking(credentials, {
      bookingUid: "booking_uid_123",
    });
    expect(result.booking).toMatchObject({
      bookingId: 123,
      bookingUid: "booking_uid_123",
      eventTypeId: 50,
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "private@example.com",
      "Private room",
      "private.example",
      "answer",
      "metadata",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects unsafe identity and resource identifiers", async () => {
    const adapter = new CalComApiAdapter(async () => response({}));
    await expect(
      adapter.listBookings({ ...credentials, userId: "../oauth" }),
    ).rejects.toMatchObject<Partial<CalComApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      adapter.getBooking(credentials, { bookingUid: "../token" }),
    ).rejects.toMatchObject<Partial<CalComApiError>>({
      code: "provider_validation_error",
    });
  });
});
