import { SalesforceApiAdapter } from "./salesforce-api.adapter";

const credentials = {
  accessToken: "secret-access",
  organizationId: "00D000000000001",
  instanceOrigin: "https://relay.my.salesforce.com",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("SalesforceApiAdapter", () => {
  it("uses fixed bounded queries and redacts unselected record fields", async () => {
    const urls: string[] = [];
    const adapter = new SalesforceApiAdapter(async (url) => {
      urls.push(url);
      const q = new URL(url).searchParams.get("q") ?? "";
      if (q.includes("FROM Organization"))
        return response({
          records: [
            {
              Id: credentials.organizationId,
              Name: "Relay Ltd",
              private: "hidden",
            },
          ],
        });
      if (q.includes("FROM Account"))
        return response({
          records: [
            {
              Id: "001000000000001",
              Name: "Acme",
              Industry: "Software",
              Type: "Customer",
              BillingAddress: "hidden",
            },
          ],
        });
      return response({
        records: [
          {
            Id: "006000000000001",
            Name: "Renewal",
            StageName: "Proposal",
            Amount: 5000,
            CloseDate: "2026-09-01",
            Probability: 60,
            IsClosed: false,
            IsWon: false,
            ContactId: "hidden",
          },
        ],
      });
    });
    expect(await adapter.health(credentials)).toEqual({
      organization: {
        organizationId: credentials.organizationId,
        name: "Relay Ltd",
      },
      apiVersion: "v67.0",
    });
    const accounts = await adapter.listAccounts(credentials, { limit: 7 });
    const opportunities = await adapter.listOpportunities(credentials, {
      limit: 5,
    });
    await adapter.getOpportunity(credentials, {
      opportunityId: "006000000000001",
    });
    expect(new URL(urls[1]).searchParams.get("q")).toContain(
      "SELECT Id, Name, Industry, Type FROM Account ORDER BY LastModifiedDate DESC LIMIT 7",
    );
    expect(new URL(urls[2]).searchParams.get("q")).toContain("LIMIT 5");
    expect(new URL(urls[3]).searchParams.get("q")).toContain(
      "WHERE Id = '006000000000001' LIMIT 1",
    );
    expect(
      urls.every((url) =>
        url.startsWith(
          "https://relay.my.salesforce.com/services/data/v67.0/query?q=",
        ),
      ),
    ).toBe(true);
    expect(JSON.stringify({ accounts, opportunities })).not.toMatch(
      /hidden|BillingAddress|ContactId/,
    );
  });

  it("rejects invalid organization, instance, opportunity, and limits before network", async () => {
    const request = jest.fn();
    const adapter = new SalesforceApiAdapter(request);
    await expect(
      adapter.listAccounts({ ...credentials, organizationId: "../org" }, {}),
    ).rejects.toMatchObject({
      code: "salesforce_organization_binding_invalid",
    });
    await expect(
      adapter.listAccounts(
        { ...credentials, instanceOrigin: "https://evil.example" },
        {},
      ),
    ).rejects.toMatchObject({ code: "salesforce_instance_binding_invalid" });
    await expect(
      adapter.getOpportunity(credentials, { opportunityId: "../opportunity" }),
    ).rejects.toMatchObject({ code: "salesforce_opportunity_id_invalid" });
    await expect(
      adapter.listAccounts(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "salesforce_input_invalid" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps provider errors without exposing bodies or tokens", async () => {
    const adapter = new SalesforceApiAdapter(async () =>
      response({ message: "secret-access provider detail" }, 403),
    );
    await expect(adapter.listAccounts(credentials, {})).rejects.toMatchObject({
      code: "salesforce_permission_denied",
      statusCode: 403,
      details: { retryAfter: null },
    });
    await expect(
      adapter.listAccounts(credentials, {}),
    ).rejects.not.toMatchObject({
      details: expect.objectContaining({ providerMessage: expect.anything() }),
    });
  });
});
