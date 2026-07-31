import {
  MicrosoftDynamics365BusinessCentralApiAdapter,
  MicrosoftDynamics365BusinessCentralApiError,
} from "./microsoft-dynamics-365-business-central-api.adapter";

describe("MicrosoftDynamics365BusinessCentralApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins a bounded, minimized company directory to the selected environment", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          value: [
            {
              id: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
              name: "CRONUS US",
              displayName: "CRONUS USA, Inc.",
              systemCreatedBy: "discarded",
            },
          ],
          "@odata.nextLink": "discarded",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new MicrosoftDynamics365BusinessCentralApiAdapter().read(
        "access-token",
        "Production",
        "companies.list",
      ),
    ).resolves.toEqual({
      environmentName: "Production",
      companies: [
        {
          id: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
          name: "CRONUS US",
          displayName: "CRONUS USA, Inc.",
        },
      ],
    });
    const url = fetchSpy.mock.calls[0]?.[0] as URL;
    expect(url.origin + url.pathname).toBe(
      "https://api.businesscentral.dynamics.com/v2.0/Production/api/v2.0/companies",
    );
    expect(url.searchParams.get("$select")).toBe("id,name,displayName");
    expect(url.searchParams.get("$top")).toBe("50");
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("blocks arbitrary operations and invalid environment routing", () => {
    const adapter = new MicrosoftDynamics365BusinessCentralApiAdapter();
    expect(() =>
      adapter.read("access-token", "Production", "customers.list"),
    ).toThrow(MicrosoftDynamics365BusinessCentralApiError);
    expect(() => adapter.normalizeEnvironmentName("../admin")).toThrow(
      MicrosoftDynamics365BusinessCentralApiError,
    );
  });
});
