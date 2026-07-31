import {
  SalesforceMarketingCloudApiAdapter,
  SalesforceMarketingCloudApiError,
} from "./salesforce-marketing-cloud-api.adapter";

const credentials = {
  subdomain: "mc123abc",
  clientId: "client-id",
  clientSecret: "client-secret",
  accountId: "123456789",
};

describe("SalesforceMarketingCloudApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("requests an empty-scope business-unit token and strips token context", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "derived-token",
            token_type: "Bearer",
            expires_in: 1080,
            scope: "",
            rest_instance_url: "https://mc123abc.rest.marketingcloudapis.com/",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accountId: "123456789",
            user: { email: "private@example.com" },
            permissions: ["private"],
          }),
          { status: 200 },
        ),
      );
    const result =
      await new SalesforceMarketingCloudApiAdapter().getBusinessUnitContext(
        credentials,
      );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://mc123abc.auth.marketingcloudapis.com/v2/token",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      grant_type: "client_credentials",
      client_id: "client-id",
      client_secret: "client-secret",
      account_id: 123456789,
      scope: "",
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://mc123abc.rest.marketingcloudapis.com/platform/v1/tokenContext",
    );
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer derived-token");
    expect(result.businessUnit).toEqual({
      accountId: "123456789",
      tokenContextAvailable: true,
      privateContextIncluded: false,
      requestedScope: "",
    });
    expect(JSON.stringify(result)).not.toMatch(/private@example|permissions/i);
  });

  it("reuses the bounded token and suppresses raw platform endpoint details", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "derived-token",
            token_type: "Bearer",
            expires_in: 1080,
            scope: "",
            rest_instance_url: "https://mc123abc.rest.marketingcloudapis.com/",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accountId: "123456789" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ type: "private", url: "https://private.example/path" }],
          }),
          { status: 200 },
        ),
      );
    const adapter = new SalesforceMarketingCloudApiAdapter();
    await adapter.getBusinessUnitContext(credentials);
    const result = await adapter.getEndpointSummary(credentials);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2][0])).toBe(
      "https://mc123abc.rest.marketingcloudapis.com/platform/v1/endpoints",
    );
    expect(result.endpoints).toEqual({
      accountId: "123456789",
      restHost: "mc123abc.rest.marketingcloudapis.com",
      platformEndpointsAvailable: true,
      rawEndpointDetailsIncluded: false,
      requestedScope: "",
    });
    expect(JSON.stringify(result)).not.toMatch(/private\.example|items/i);
  });

  it("rejects an untrusted tenant subdomain before a provider call", async () => {
    await expect(
      new SalesforceMarketingCloudApiAdapter().getEndpointSummary({
        ...credentials,
        subdomain: "attacker.example",
      }),
    ).rejects.toMatchObject<Partial<SalesforceMarketingCloudApiError>>({
      code: "provider_validation_error",
    });
  });

  it("rejects any non-empty scope returned for the empty-scope request", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "derived-token",
          token_type: "Bearer",
          expires_in: 1080,
          scope: "email_read",
          rest_instance_url: "https://mc123abc.rest.marketingcloudapis.com/",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new SalesforceMarketingCloudApiAdapter().getEndpointSummary(credentials),
    ).rejects.toMatchObject<Partial<SalesforceMarketingCloudApiError>>({
      code: "policy_blocked",
    });
  });
});
