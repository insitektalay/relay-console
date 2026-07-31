import {
  SevenShiftsApiAdapter,
  SevenShiftsApiError,
} from "./seven-shifts-api.adapter";

describe("SevenShiftsApiAdapter", () => {
  const adapter = new SevenShiftsApiAdapter();
  const credentials = {
    accessToken: "token",
    companyGuid: "company-guid",
    companyId: "123",
  };

  afterEach(() => jest.restoreAllMocks());

  it("pins origin, version, company authority, and an exact read operation", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await adapter.read(credentials, "listCompanies", {});
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.7shifts.com/v2/companies");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer token",
      "x-company-guid": "company-guid",
      "x-api-version": "2026-06-01",
    });
  });

  it("binds company path parameters and rejects cross-company requests", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.read(credentials, "getLocationListByCompany", {
          pathParameters: { company_id: "999" },
        }),
      ),
    ).rejects.toMatchObject<Partial<SevenShiftsApiError>>({
      code: "policy_blocked",
    });
  });

  it("separates reads from mutations", async () => {
    await expect(
      Promise.resolve().then(() =>
        adapter.manage(credentials, "listCompanies", {}),
      ),
    ).rejects.toMatchObject<Partial<SevenShiftsApiError>>({
      code: "provider_validation_error",
    });
  });

  it("rejects credential-bearing request fields", async () => {
    await expect(
      adapter.read(credentials, "listCompanies", {
        query: { token: "escape" },
      }),
    ).rejects.toMatchObject<Partial<SevenShiftsApiError>>({
      code: "policy_blocked",
    });
  });
});
