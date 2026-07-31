import {
  MicrosoftDynamics365CustomerServiceApiAdapter,
  MicrosoftDynamics365CustomerServiceApiError,
} from "./microsoft-dynamics-365-customer-service-api.adapter";

describe("MicrosoftDynamics365CustomerServiceApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins WhoAmI and minimizes the Dataverse identity response", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          UserId: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
          OrganizationId: "00aa00aa-bb11-4c22-ad33-44ee44ee44ee",
          BusinessUnitId: "11bb11bb-cc22-4d33-ae44-55ff55ff55ff",
          caseData: "discarded",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new MicrosoftDynamics365CustomerServiceApiAdapter().read(
        "access-token",
        "https://support.crm.dynamics.com",
        "identity.get",
      ),
    ).resolves.toEqual({
      userId: "22cc22cc-dd33-4e44-af55-66aa66aa66aa",
      organizationId: "00aa00aa-bb11-4c22-ad33-44ee44ee44ee",
      businessUnitId: "11bb11bb-cc22-4d33-ae44-55ff55ff55ff",
      environmentOrigin: "https://support.crm.dynamics.com",
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toEqual(
      new URL("https://support.crm.dynamics.com/api/data/v9.2/WhoAmI"),
    );
  });

  it("blocks case access and untrusted Dataverse authorities", async () => {
    const adapter = new MicrosoftDynamics365CustomerServiceApiAdapter();
    await expect(
      adapter.read(
        "access-token",
        "https://support.crm.dynamics.com",
        "cases.list",
      ),
    ).rejects.toBeInstanceOf(MicrosoftDynamics365CustomerServiceApiError);
    expect(() => adapter.normalizeEnvironment("https://evil.example")).toThrow(
      MicrosoftDynamics365CustomerServiceApiError,
    );
  });
});
