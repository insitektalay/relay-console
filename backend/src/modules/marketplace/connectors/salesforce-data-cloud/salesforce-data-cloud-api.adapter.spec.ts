import {
  SalesforceDataCloudApiAdapter,
  type SalesforceDataCloudCredentials,
} from "./salesforce-data-cloud-api.adapter";
import {
  SALESFORCE_DATA_CLOUD_OPERATIONS,
  SALESFORCE_DATA_CLOUD_SENSITIVE_READ_OPERATION_IDS,
  SALESFORCE_DATA_CLOUD_STRUCTURAL_READ_OPERATION_IDS,
} from "./salesforce-data-cloud-operation-registry";

describe("SalesforceDataCloudApiAdapter", () => {
  const credentials: SalesforceDataCloudCredentials = {
    clientId: "client",
    clientSecret: "secret",
    loginEnvironment: "sandbox",
  };

  afterEach(() => jest.restoreAllMocks());

  it("pins four Query API v3 operations with a 1/3 policy split", () => {
    expect(SALESFORCE_DATA_CLOUD_OPERATIONS).toHaveLength(4);
    expect(SALESFORCE_DATA_CLOUD_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(SALESFORCE_DATA_CLOUD_SENSITIVE_READ_OPERATION_IDS).toHaveLength(3);
  });

  it("performs both fixed token exchanges and submits a server-bounded query", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "core-token",
            instance_url: "https://relay.sandbox.my.salesforce.com",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "data-token",
            instance_url: "https://relay.us1.c360a.salesforce.com",
            expires_in: 1_800,
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response('{"data":null,"returnedRows":0}', {
          headers: {
            status: JSON.stringify({ queryId: "query_1" }),
          },
        }),
      );

    const result = await new SalesforceDataCloudApiAdapter().read(
      credentials,
      "submit_bounded_query",
      { sql: "SELECT Id__c FROM Individual__dlm", rowLimit: 25 },
    );

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://test.salesforce.com/services/oauth2/token",
    );
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://relay.sandbox.my.salesforce.com/services/a360/token",
    );
    expect(
      new URLSearchParams(String(fetchMock.mock.calls[1][1]?.body)).get(
        "grant_type",
      ),
    ).toBe("urn:salesforce:grant-type:external:cdp");
    expect(String(fetchMock.mock.calls[2][0])).toBe(
      "https://relay.us1.c360a.salesforce.com/api/v3/query",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toEqual({
      sql: "SELECT Id__c FROM Individual__dlm",
      transferMode: "ASYNC",
      queryRowLimit: 25,
    });
    expect(result).toMatchObject({ queryStatus: { queryId: "query_1" } });
  });

  it("pins row pagination and payload bounds", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "core-token",
            instance_url: "https://relay.my.salesforce.com",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "data-token",
            instance_url: "https://relay.eu1.c360a.salesforce.com",
            expires_in: 1_800,
          }),
        ),
      )
      .mockResolvedValueOnce(new Response('{"data":[],"returnedRows":0}'));

    await new SalesforceDataCloudApiAdapter().read(
      credentials,
      "get_query_rows",
      { queryId: "query_1", offset: 20 },
    );

    expect(String(fetchMock.mock.calls[2][0])).toBe(
      "https://relay.eu1.c360a.salesforce.com/api/v3/query/query_1/rows?offset=20&limit=200&byteLimit=1000000&omitSchema=false",
    );
  });

  it("blocks unsafe SQL, secret fields, and arbitrary operations before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new SalesforceDataCloudApiAdapter();
    await expect(
      adapter.read(credentials, "submit_bounded_query", {
        sql: "SELECT * FROM Individual__dlm",
        rowLimit: 10,
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.read(credentials, "get_query_status", {
        queryId: "query_1",
        endpoint: "https://attacker.example",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(() => adapter.read(credentials, "export_all", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a token-supplied non-Data-Cloud tenant origin", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "core-token",
            instance_url: "https://relay.my.salesforce.com",
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "data-token",
            instance_url: "https://attacker.example",
            expires_in: 1_800,
          }),
        ),
      );
    await expect(
      new SalesforceDataCloudApiAdapter().health(credentials),
    ).rejects.toMatchObject({ code: "token_refresh_failed" });
  });
});
