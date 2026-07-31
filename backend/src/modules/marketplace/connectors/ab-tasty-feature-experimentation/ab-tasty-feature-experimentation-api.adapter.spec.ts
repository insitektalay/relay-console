import {
  AbTastyFeatureExperimentationApiAdapter,
  type AbTastyFeatureExperimentationCredentials,
} from "./ab-tasty-feature-experimentation-api.adapter";
import { AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS } from "./ab-tasty-feature-experimentation-operation-registry";

describe("AbTastyFeatureExperimentationApiAdapter", () => {
  const credentials: AbTastyFeatureExperimentationCredentials = {
    remoteControlApiToken: "test-remote-control-token",
    accountId: "account-123",
    accountEnvironmentId: "environment-456",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only account-environment campaign list and exact GETs", () => {
    expect(AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS).toHaveLength(2);
    expect(
      AB_TASTY_FEATURE_EXPERIMENTATION_OPERATIONS.map((item) => item.path),
    ).toEqual([
      "/v1/accounts/{accountId}/account_environments/{accountEnvironmentId}/campaigns",
      "/v1/accounts/{accountId}/account_environments/{accountEnvironmentId}/campaigns/{resourceId}",
    ]);
  });
  it("uses fixed routing, first-page bounds, bearer auth, and redaction", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          current_item_count: 1,
          total_count: 1,
          items: [
            {
              id: "campaign-1",
              project_id: "project-1",
              name: "Checkout test",
              status: "active",
              scheduler: { start_date: "private-schedule" },
              primary_goal: { label: "private-goal", metrics: ["revenue"] },
              variation_groups: [{ targeting: { user: "private-user" } }],
              flags: { checkout: "private-value" },
            },
          ],
          next: "private-cursor",
        }),
      ),
    );
    const result = await new AbTastyFeatureExperimentationApiAdapter().read(
      credentials,
      "list_campaigns",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.flagship.io/v1/accounts/account-123/account_environments/environment-456/campaigns?_page=0&_max_per_page=25",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer test-remote-control-token",
    });
    expect(JSON.stringify(result)).not.toContain("private-schedule");
    expect(JSON.stringify(result)).not.toContain("private-goal");
    expect(JSON.stringify(result)).not.toContain("private-user");
    expect(JSON.stringify(result)).not.toContain("private-value");
    expect(JSON.stringify(result)).not.toContain("private-cursor");
  });
  it("pins exact safe campaign reads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"id":"campaign-1","name":"Checkout test"}'),
      );
    await new AbTastyFeatureExperimentationApiAdapter().read(
      credentials,
      "get_campaign",
      { resourceId: "campaign-1" },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.flagship.io/v1/accounts/account-123/account_environments/environment-456/campaigns/campaign-1",
    );
  });
  it("blocks private routing, pagination, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new AbTastyFeatureExperimentationApiAdapter();
    await expect(
      adapter.read(credentials, "list_campaigns", {
        environment: "production",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_campaign", { resourceId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "toggle_campaign", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
