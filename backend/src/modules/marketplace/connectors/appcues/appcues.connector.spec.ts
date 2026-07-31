import { AppcuesApiAdapter, AppcuesApiError } from "./appcues-api.adapter";
import { APPCUES_CONNECTOR_MANIFEST } from "./appcues.connector";

const credentials = {
  apiKey: "key",
  apiSecret: "secret",
  accountId: "account-1",
  region: "us",
};

describe("Appcues connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated flow inventory read", () => {
    expect(APPCUES_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read"],
    );
    expect(
      APPCUES_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["appcues_flows_list"]);
  });

  it("checks credentials without returning flow data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ id: "private-flow" }]), { status: 200 }),
      );
    const result = await new AppcuesApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactAccountBound: true,
      flowDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-flow");
  });

  it("lists only bounded projected flow metadata", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "flow-1",
              name: "Onboarding",
              published: true,
              frequency: "once",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
              published_at: "2026-01-02T00:00:00Z",
              created_by: "private-user",
              tag_ids: ["private-tag"],
              url: "private-url",
            },
          ]),
          { status: 200 },
        ),
      );
    const result = await new AppcuesApiAdapter().listFlows(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.appcues.com/v2/accounts/account-1/flows",
    );
    expect(result.flows).toEqual([
      {
        flowId: "flow-1",
        name: "Onboarding",
        published: true,
        frequency: "once",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        publishedAt: "2026-01-02T00:00:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-user|private-tag|private-url/,
    );
  });

  it("rejects invalid credentials, account IDs, regions, and limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new AppcuesApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiSecret: "" }),
    ).rejects.toBeInstanceOf(AppcuesApiError);
    await expect(
      adapter.health({ ...credentials, accountId: "../other" }),
    ).rejects.toBeInstanceOf(AppcuesApiError);
    await expect(
      adapter.health({ ...credentials, region: "ap" }),
    ).rejects.toBeInstanceOf(AppcuesApiError);
    await expect(
      adapter.listFlows(credentials, { limit: 51 }),
    ).rejects.toBeInstanceOf(AppcuesApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new AppcuesApiAdapter().listFlows(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
