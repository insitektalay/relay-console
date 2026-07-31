import {
  SmartlookApiAdapter,
  SmartlookApiError,
} from "./smartlook-api.adapter";
import { SMARTLOOK_CONNECTOR_MANIFEST } from "./smartlook.connector";

const credentials = { apiToken: "customer-project-token", region: "eu" };

describe("Smartlook connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated event-definition read", () => {
    expect(
      SMARTLOOK_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["SMARTLOOK_API_TOKEN", "SMARTLOOK_REGION"]);
    expect(
      SMARTLOOK_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      SMARTLOOK_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["smartlook_event_definitions_list"]);
  });

  it("validates the exact regional project token without returning event data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            events: [{ id: "private-event", name: "Checkout" }],
          }),
          { status: 200 },
        ),
      );
    const result = await new SmartlookApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.eu.smartlook.cloud/api/v1/events?limit=1",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer customer-project-token",
    });
    expect(result).toMatchObject({
      apiTokenVerified: true,
      exactProjectToken: true,
      region: "eu",
      eventDataReturned: false,
      visitorDataReturned: false,
      sessionDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-event");
  });

  it("lists only bounded event-definition identity and classification metadata", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          events: [
            {
              id: "event-1",
              name: "Checkout completed",
              type: "custom",
              categoryId: "commerce",
              selector: "#buy-button",
              url: "https://private.example/checkout",
              visitor: { email: "person@example.com" },
              properties: { order: "private" },
            },
          ],
          pagination: { after: "private-cursor" },
          _links: { nextPage: "/api/v1/events?after=private" },
        }),
        { status: 200 },
      ),
    );
    const result = await new SmartlookApiAdapter().listEventDefinitions(
      credentials,
      { limit: 1 },
    );
    expect(result.definitions).toEqual([
      {
        eventId: "event-1",
        name: "Checkout completed",
        type: "custom",
        categoryId: "commerce",
      },
    ]);
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "#buy-button",
      "private.example",
      "person@example.com",
      "private-cursor",
      "nextPage",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects missing tokens, invalid regions, and invalid limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SmartlookApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiToken: "" }),
    ).rejects.toBeInstanceOf(SmartlookApiError);
    await expect(
      adapter.health({ ...credentials, region: "br" }),
    ).rejects.toBeInstanceOf(SmartlookApiError);
    await expect(
      adapter.listEventDefinitions(credentials, { limit: 26 }),
    ).rejects.toBeInstanceOf(SmartlookApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new SmartlookApiAdapter().listEventDefinitions(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
