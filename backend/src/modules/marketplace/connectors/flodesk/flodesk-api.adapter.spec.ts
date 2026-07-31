import {
  FlodeskApiAdapter,
  type FlodeskCredentials,
} from "./flodesk-api.adapter";

const credentials: FlodeskCredentials = {
  apiKey: "test-flodesk-api-key",
  subscriberId: "subscriber_123",
  segmentId: "segment_456",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("FlodeskApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the selected subscriber path and strips private fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: "subscriber_123",
        created_at: "2026-01-01T00:00:00Z",
        status: "active",
        email: "private@example.com",
        source: "manual",
        first_name: "Private",
        last_name: "Private",
        segments: [{ id: "private", name: "Private" }],
        custom_fields: { private: "Private" },
        optin_ip: "192.0.2.1",
        optin_timestamp: "2026-01-01T00:00:00Z",
      }),
    );
    await expect(
      new FlodeskApiAdapter().getSubscriberSummary(credentials),
    ).resolves.toEqual({
      subscriber: {
        id: "subscriber_123",
        createdAt: "2026-01-01T00:00:00Z",
        privateSubscriberDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.flodesk.com/v1/subscribers/subscriber_123",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe(`Basic ${Buffer.from("test-flodesk-api-key:").toString("base64")}`);
  });

  it("projects only bounded segment metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: "segment_456",
        name: "Private",
        total_active_subscribers: 100,
        created_at: "2026-01-02T00:00:00Z",
        color: "#ffffff",
      }),
    );
    await expect(
      new FlodeskApiAdapter().getSegmentSummary(credentials),
    ).resolves.toEqual({
      segment: {
        id: "segment_456",
        createdAt: "2026-01-02T00:00:00Z",
        privateSegmentDetailsIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.flodesk.com/v1/segments/segment_456",
    );
  });

  it("rejects email selectors before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new FlodeskApiAdapter().getSubscriberSummary({
        ...credentials,
        subscriberId: "private@example.com",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps throttling without exposing provider content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private" }, 429));
    await expect(
      new FlodeskApiAdapter().getSegmentSummary(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
