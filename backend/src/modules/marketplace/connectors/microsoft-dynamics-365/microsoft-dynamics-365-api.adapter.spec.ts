import {
  MicrosoftDynamics365ApiAdapter,
  MicrosoftDynamics365ApiError,
} from "./microsoft-dynamics-365-api.adapter";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("MicrosoftDynamics365ApiAdapter", () => {
  const binding = {
    environmentOrigin: "https://contoso.api.crm.dynamics.com",
  };

  it("uses fixed selected-environment GET paths and projections", async () => {
    const calls: URL[] = [];
    const adapter = new MicrosoftDynamics365ApiAdapter(async (url, init) => {
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      calls.push(new URL(url));
      if (url.includes("/organizations"))
        return response({
          value: [
            {
              organizationid: "org-1",
              friendlyname: "Contoso Sales",
              uniquename: "contososales",
              version: "9.2",
              languagecode: 1033,
            },
          ],
        });
      if (url.includes("/opportunities"))
        return response({
          value: [
            {
              opportunityid: "opp-1",
              name: "Renewal",
              estimatedvalue: 125000,
              _customerid_value: "blocked",
              _ownerid_value: "blocked",
            },
          ],
          "@odata.nextLink": "https://blocked.example/next",
        });
      return response({
        value: [
          {
            accountid: "account-1",
            name: "Adventure Works",
            revenue: 2500000,
            address1_line1: "blocked",
            _ownerid_value: "blocked",
          },
        ],
      });
    });

    const organization = await adapter.getOrganization("token", binding);
    const accounts = await adapter.listAccounts("token", binding);
    const opportunities = await adapter.listOpportunities("token", binding);

    expect(organization.organization).toMatchObject({
      friendlyName: "Contoso Sales",
      identityFieldsExcluded: true,
      schemaExcluded: true,
    });
    expect(accounts.accounts[0]).toMatchObject({
      name: "Adventure Works",
      revenue: 2500000,
      addressesExcluded: true,
      ownersExcluded: true,
    });
    expect(accounts.accounts[0]).not.toHaveProperty("address1_line1");
    expect(opportunities.opportunities[0]).toMatchObject({
      name: "Renewal",
      customerLookupExcluded: true,
      ownerExcluded: true,
    });
    expect(opportunities.nextPageFollowed).toBe(false);
    expect(calls.every((url) => url.origin === binding.environmentOrigin)).toBe(
      true,
    );
    expect(calls[1].searchParams.get("$top")).toBe("25");
    expect(calls[1].searchParams.get("$select")).not.toContain("address");
  });

  it("requires a safe explicit account ID", async () => {
    const adapter = new MicrosoftDynamics365ApiAdapter(async () =>
      response({}),
    );
    await expect(
      adapter.getAccount("token", binding, { accountId: "x?$expand=ownerid" }),
    ).rejects.toMatchObject<Partial<MicrosoftDynamics365ApiError>>({
      code: "microsoft_dynamics_365_input_invalid",
    });
  });

  it("rejects untrusted or non-origin environment URLs", () => {
    const adapter = new MicrosoftDynamics365ApiAdapter();
    expect(() =>
      adapter.normalizeEnvironmentOrigin("https://contoso.example.com"),
    ).toThrow(MicrosoftDynamics365ApiError);
    expect(() =>
      adapter.normalizeEnvironmentOrigin(
        "https://contoso.api.crm.dynamics.com/other",
      ),
    ).toThrow(MicrosoftDynamics365ApiError);
  });
});
