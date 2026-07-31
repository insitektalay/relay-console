import {
  MicrosoftDynamics365SalesApiAdapter,
  MicrosoftDynamics365SalesApiError,
} from "./microsoft-dynamics-365-sales-api.adapter";

describe("MicrosoftDynamics365SalesApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins WhoAmI to the selected Dataverse environment", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          UserId: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
          OrganizationId: "00aa00aa-bb11-4c22-ad33-44ee44ee44ee",
          BusinessUnitId: "11bb11bb-cc22-4d33-ae44-55ff55ff55ff",
          ignoredSensitiveField: "discarded",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new MicrosoftDynamics365SalesApiAdapter().read(
        "access-token",
        "https://relay.crm.dynamics.com",
        "identity.get",
      ),
    ).resolves.toEqual({
      userId: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
      organizationId: "00aa00aa-bb11-4c22-ad33-44ee44ee44ee",
      businessUnitId: "11bb11bb-cc22-4d33-ae44-55ff55ff55ff",
      environmentOrigin: "https://relay.crm.dynamics.com",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL("https://relay.crm.dynamics.com/api/data/v9.2/WhoAmI"),
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });

  it("blocks arbitrary Dataverse operations and authorities", () => {
    const adapter = new MicrosoftDynamics365SalesApiAdapter();
    expect(() =>
      adapter.read(
        "access-token",
        "https://relay.crm.dynamics.com",
        "accounts.list",
      ),
    ).toThrow(MicrosoftDynamics365SalesApiError);
    expect(() => adapter.normalizeEnvironment("https://evil.example")).toThrow(
      MicrosoftDynamics365SalesApiError,
    );
  });
});
