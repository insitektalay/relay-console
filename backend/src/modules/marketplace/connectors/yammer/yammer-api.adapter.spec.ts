import { YammerApiAdapter, YammerApiError } from "./yammer-api.adapter";

describe("YammerApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins and minimizes the supported current-user endpoint", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 12345,
          full_name: "Relay Operator",
          email: "operator@example.com",
          network_id: 9876,
          stats: { following: 99 },
        }),
        { status: 200 },
      ),
    );
    await expect(
      new YammerApiAdapter().read("access-token", "identity.get"),
    ).resolves.toEqual({
      id: "12345",
      fullName: "Relay Operator",
      email: "operator@example.com",
      networkId: "9876",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://www.yammer.com/api/v1/users/current.json",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("blocks arbitrary Yammer operations", () => {
    expect(() =>
      new YammerApiAdapter().read("access-token", "messages.list"),
    ).toThrow(YammerApiError);
  });
});
