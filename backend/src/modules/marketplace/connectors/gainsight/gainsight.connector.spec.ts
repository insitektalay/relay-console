import {
  GainsightApiAdapter,
  GainsightApiError,
} from "./gainsight-api.adapter";
import { GAINSIGHT_CONNECTOR_MANIFEST } from "./gainsight.connector";

const credentials = {
  accessKey: "access-key",
  tenantOrigin: "https://example.gainsightcloud.com",
};

describe("Gainsight connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated object-metadata read", () => {
    expect(
      GAINSIGHT_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      GAINSIGHT_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["gainsight_objects_list"]);
  });

  it("checks credentials without returning object data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ result: true, data: [{ objectName: "private" }] }),
          { status: 200 },
        ),
      );
    const result = await new GainsightApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactTenantBound: true,
      objectDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("lists only bounded projected object metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          requestId: "private-request",
          result: true,
          data: [
            {
              objectName: "company",
              label: "Company",
              objectType: "STANDARD",
              transactional: false,
              multiCurrencySupported: true,
              readable: true,
              keyPrefix: "private-prefix",
              createable: true,
              schemaUpdateable: true,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new GainsightApiAdapter().listObjects(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.gainsightcloud.com/v1/meta/services/objects/list?po=company&em=false",
    );
    expect(result.objects).toEqual([
      {
        objectName: "company",
        label: "Company",
        objectType: "STANDARD",
        transactional: false,
        multiCurrencySupported: true,
        readable: true,
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-request|private-prefix|createable|schemaUpdateable/,
    );
  });

  it("rejects missing keys, unsafe origins, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new GainsightApiAdapter();
    await expect(
      adapter.health({ ...credentials, accessKey: "" }),
    ).rejects.toBeInstanceOf(GainsightApiError);
    await expect(
      adapter.health({ ...credentials, tenantOrigin: "https://example.test" }),
    ).rejects.toBeInstanceOf(GainsightApiError);
    await expect(
      adapter.listObjects(credentials, { limit: 101 }),
    ).rejects.toBeInstanceOf(GainsightApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new GainsightApiAdapter().listObjects(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
