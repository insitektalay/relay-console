import { AgileCrmApiAdapter } from "./agile-crm-api.adapter";

const credentials = {
  domain: "relay-fixture",
  email: "agent@example.com",
  apiKey: "fixture-api-key",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("AgileCrmApiAdapter", () => {
  it("uses only the exact tenant and fixed bounded Deal paths", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const responses: unknown[] = [
      [{ id: 7, name: "Deal", contacts: [{ email: "private@example.com" }] }],
      {
        id: 7,
        name: "Deal",
        description: "private",
        owner: { email: "owner@example.com" },
      },
    ];
    const adapter = new AgileCrmApiAdapter(async (url, init) => {
      calls.push({ url, init });
      return json(responses.shift());
    });

    const list = await adapter.listDeals(credentials, { limit: 3 });
    const exact = await adapter.getDeal(credentials, { dealId: "7" });

    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      [
        "GET",
        "https://relay-fixture.agilecrm.com/dev/api/opportunity?page_size=3",
      ],
      ["GET", "https://relay-fixture.agilecrm.com/dev/api/opportunity/7"],
    ]);
    expect(
      (calls[0].init.headers as Record<string, string>).Authorization,
    ).toBe(
      `Basic ${Buffer.from("agent@example.com:fixture-api-key").toString("base64")}`,
    );
    expect(list.deals[0]).not.toHaveProperty("contacts");
    expect(exact.deal).not.toHaveProperty("description");
    expect(exact.deal).not.toHaveProperty("owner");
  });

  it("rejects untrusted tenants, credentials, IDs, and limits before network access", async () => {
    const request = jest.fn();
    const adapter = new AgileCrmApiAdapter(request);
    await expect(
      adapter.listDeals({ ...credentials, domain: "other.example.com" }, {}),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listDeals({ ...credentials, email: "not-an-email" }, {}),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listDeals({ ...credentials, apiKey: "" }, {}),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.getDeal(credentials, { dealId: "7/notes" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.listDeals(credentials, { limit: 26 }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(request).not.toHaveBeenCalled();
  });

  it("maps failures without returning provider response data", async () => {
    const adapter = new AgileCrmApiAdapter(async () =>
      json({ message: "denied fixture-api-key" }, 401),
    );
    await expect(adapter.listDeals(credentials, {})).rejects.toMatchObject({
      code: "credential_missing",
      message: "Agile CRM API request failed.",
      statusCode: 401,
    });
  });

  it("validates health with a one-row request on the bound tenant", async () => {
    const request = jest.fn(async () => json([]));
    const adapter = new AgileCrmApiAdapter(request);
    await expect(adapter.health(credentials)).resolves.toEqual({
      tenantHost: "relay-fixture.agilecrm.com",
      authorizingEmail: "agent@example.com",
      apiVersion: "dev/api",
      reachable: true,
    });
    expect(request).toHaveBeenCalledWith(
      "https://relay-fixture.agilecrm.com/dev/api/opportunity?page_size=1",
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });
});
