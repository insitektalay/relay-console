import { HomebaseApiAdapter, HomebaseApiError } from "./homebase-api.adapter";

describe("HomebaseApiAdapter", () => {
  const adapter = new HomebaseApiAdapter();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("pins Homebase reads to the official API origin and version", async () => {
    global.fetch = jest.fn(
      async (url: URL | RequestInfo, init?: RequestInit) => {
        expect(String(url)).toBe("https://api.joinhomebase.com/company");
        expect(init?.method).toBe("GET");
        expect((init?.headers as Record<string, string>).Accept).toBe(
          "application/vnd.homebase-v1+json",
        );
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          "Bearer homebase-key",
        );
        return new Response(JSON.stringify({ id: 7, name: "Test Company" }), {
          status: 200,
          headers: { total: "1", "per-page": "100" },
        });
      },
    ) as typeof fetch;

    await expect(
      adapter.read({ apiKey: "homebase-key" }, "getCompany", {}),
    ).resolves.toEqual({
      data: { id: 7, name: "Test Company" },
      pagination: { total: 1, perPage: 100, link: null },
    });
  });

  it("binds documented path and query parameters with pagination limits", async () => {
    global.fetch = jest.fn(async (url: URL | RequestInfo) => {
      expect(String(url)).toBe(
        "https://api.joinhomebase.com/locations/location-1/employees?page=2&per_page=100&with_archived=true",
      );
      return new Response("[]", { status: 200 });
    }) as typeof fetch;

    await adapter.read(
      { apiKey: "homebase-key" },
      "getLocationsLocationUuidEmployees",
      {
        pathParameters: { location_uuid: "location-1" },
        query: { page: 2, per_page: 100, with_archived: true },
      },
    );
  });

  it("rejects unknown operations, parameters, and credential-shaped input", async () => {
    await expect(
      adapter.read({ apiKey: "homebase-key" }, "notDocumented", {}),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read({ apiKey: "homebase-key" }, "getCompany", {
        query: { accessToken: "do-not-forward" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(
        { apiKey: "homebase-key" },
        "getLocationsLocationUuidEmployees",
        {
          pathParameters: { location_uuid: "location-1" },
          query: { per_page: 101 },
        },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("redacts employee time-clock PIN values", async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ job: { pin: "1234", wage_rate: 12 } }), {
          status: 200,
        }),
    ) as typeof fetch;

    await expect(
      adapter.read({ apiKey: "homebase-key" }, "getCompany", {}),
    ).resolves.toMatchObject({
      data: { job: { pin: "[REDACTED]", wage_rate: 12 } },
    });
  });
});
