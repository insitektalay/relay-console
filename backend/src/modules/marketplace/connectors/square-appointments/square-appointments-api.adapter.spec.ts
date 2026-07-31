import { SquareAppointmentsApiAdapter } from "./square-appointments-api.adapter";

describe("SquareAppointmentsApiAdapter", () => {
  const adapter = new SquareAppointmentsApiAdapter();
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("binds reads to Square's fixed origin and current API version", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ bookings: [] }), { status: 200 }),
      );
    await adapter.read("access-token", {
      path: "/v2/bookings",
      query: { limit: 10 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "https://connect.squareup.com",
        pathname: "/v2/bookings",
        search: "?limit=10",
      }),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Square-Version": "2026-05-20",
        }),
        redirect: "error",
      }),
    );
  });

  it("permits documented POST reads and booking mutations", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ availabilities: [] }), { status: 200 }),
      );
    await adapter.read("access-token", {
      method: "POST",
      path: "/v2/bookings/availability/search",
      json: { query: { filter: { location_id: "L1" } } },
    });
    await adapter.manage("access-token", {
      method: "POST",
      path: "/v2/bookings/booking_1/cancel",
      json: { idempotency_key: "safe-id" },
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pathname: "/v2/bookings/booking_1/cancel" }),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("permits the complete booking custom-attribute surface", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ custom_attribute: {} }), {
            status: 200,
          }),
      );
    await adapter.read("access-token", {
      path: "/v2/bookings/booking_1/custom-attributes/key.name",
    });
    await adapter.manage("access-token", {
      method: "PUT",
      path: "/v2/bookings/booking_1/custom-attributes/key.name",
      json: { custom_attribute: { value: "blue" } },
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects unofficial, undocumented, and credential-bearing requests", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.read("access-token", { path: "https://example.com/steal" }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage("access-token", {
          method: "POST",
          path: "/v2/payments",
          json: {},
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      Promise.resolve().then(() =>
        adapter.manage("access-token", {
          method: "POST",
          path: "/v2/bookings",
          json: { apiKey: "leak" },
        }),
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
