import {
  FreshsalesApiAdapter,
  FreshsalesApiError,
} from "./freshsales-api.adapter";
import { FRESHSALES_CONNECTOR_MANIFEST } from "./freshsales.connector";

const credentials = {
  apiKey: "synthetic-api-key",
  apiBaseUrl: "https://example.myfreshworks.com/crm/sales",
};

describe("Freshsales connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated metadata read", () => {
    expect(
      FRESHSALES_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      FRESHSALES_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["freshsales_contact_filters_list"]);
  });

  it("checks credentials without returning filter data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ filters: [{ name: "Private" }] }), {
          status: 200,
        }),
      );
    const result = await new FreshsalesApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactAccountBound: true,
      filterDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
  });

  it("lists only bounded projected filter metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            filters: [
              {
                id: 7,
                name: "My Contacts",
                criteria: { owner: "private" },
                count: 42,
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new FreshsalesApiAdapter().listContactFilters(
      credentials,
      { limit: 1 },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.myfreshworks.com/crm/sales/api/contacts/filters",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { Authorization: "Token token=synthetic-api-key" },
      redirect: "error",
    });
    expect(result.filters).toEqual([{ id: "7", name: "My Contacts" }]);
    expect(JSON.stringify(result)).not.toMatch(/private|"criteria":|"count":/);
  });

  it("rejects missing keys, unsafe bases, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new FreshsalesApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.health({
        ...credentials,
        apiBaseUrl: "https://example.test/crm/sales",
      }),
    ).rejects.toBeInstanceOf(FreshsalesApiError);
    await expect(
      adapter.listContactFilters(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(FreshsalesApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new FreshsalesApiAdapter().listContactFilters(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
