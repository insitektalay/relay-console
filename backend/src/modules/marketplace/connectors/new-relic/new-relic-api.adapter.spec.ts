import { NewRelicApiAdapter } from "./new-relic-api.adapter";

describe("NewRelicApiAdapter", () => {
  it("binds entity search to the configured account and returns bounded semantics", async () => {
    const requester = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              actor: {
                entitySearch: {
                  count: 1,
                  results: {
                    entities: [
                      {
                        guid: "ENTITY_12345",
                        name: "Checkout",
                        entityType: "APM_APPLICATION",
                        reporting: true,
                        alertSeverity: "CRITICAL",
                        domain: "APM",
                        type: "APPLICATION",
                        account: { name: "should not leak" },
                      },
                    ],
                  },
                },
              },
            },
          }),
          { status: 200 },
        ),
    );
    const adapter = new NewRelicApiAdapter(requester);
    const result = await adapter.searchEntities(
      { apiKey: "secret", accountId: 1234, region: "us" },
      { query: "Checkout", limit: 5 },
    );
    const init = requester.mock.calls[0][1] as RequestInit;
    expect(requester.mock.calls[0][0]).toBe("https://api.newrelic.com/graphql");
    expect((init.headers as Record<string, string>)["API-Key"]).toBe("secret");
    expect(String(init.body)).toContain("accountId = 1234");
    expect(result.entities[0]).toEqual(
      expect.objectContaining({
        name: "Checkout",
        reporting: true,
        alertSeverity: "CRITICAL",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("should not leak");
  });

  it("rejects invalid entity GUIDs without making a request", async () => {
    const requester = jest.fn();
    const adapter = new NewRelicApiAdapter(requester);
    await expect(
      adapter.getEntity(
        { apiKey: "secret", accountId: 1234, region: "eu" },
        { guid: "../../raw" },
      ),
    ).rejects.toMatchObject({
      code: "new_relic_guid_invalid",
      statusCode: 400,
    });
    expect(requester).not.toHaveBeenCalled();
  });

  it("pins the EU endpoint and keeps account-health NRQL fixed in code", async () => {
    const requester = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: {
              actor: {
                account: {
                  id: 1234,
                  name: "Production",
                  nrql: {
                    results: [
                      {
                        transactions: 42,
                        errorPercentage: 1.5,
                        averageDuration: 0.25,
                      },
                    ],
                  },
                },
              },
            },
          }),
          { status: 200 },
        ),
    );
    const result = await new NewRelicApiAdapter(requester).readAccountHealth({
      apiKey: "secret",
      accountId: 1234,
      region: "eu",
    });
    const body = JSON.parse(String(requester.mock.calls[0][1].body));
    expect(requester.mock.calls[0][0]).toBe(
      "https://api.eu.newrelic.com/graphql",
    );
    expect(body.variables).toEqual({ accountId: 1234 });
    expect(body.query).toContain("FROM Transaction SINCE 60 MINUTES AGO");
    expect(body.query).not.toContain("$nrql");
    expect(result).toMatchObject({
      accountId: 1234,
      accountName: "Production",
      windowMinutes: 60,
      transactionHealth: { transactions: 42 },
    });
  });

  it("rejects a changed account binding during connection health", async () => {
    const requester = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            data: { actor: { account: { id: 9999, name: "Other" } } },
          }),
          { status: 200 },
        ),
    );
    await expect(
      new NewRelicApiAdapter(requester).health({
        apiKey: "secret",
        accountId: 1234,
        region: "us",
      }),
    ).rejects.toMatchObject({
      code: "new_relic_account_binding_mismatch",
      statusCode: 403,
    });
  });
});
