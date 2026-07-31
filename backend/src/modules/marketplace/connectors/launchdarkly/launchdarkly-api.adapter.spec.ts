import {
  LaunchDarklyApiAdapter,
  type LaunchDarklyCredentials,
} from "./launchdarkly-api.adapter";
import { LAUNCHDARKLY_OPERATIONS } from "./launchdarkly-operation-registry";

describe("LaunchDarklyApiAdapter", () => {
  const credentials: LaunchDarklyCredentials = {
    apiAccessToken: "api-test-token",
    region: "eu",
    projectKey: "project-a",
    environmentKey: "staging",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only list and exact feature-flag GETs", () => {
    expect(LAUNCHDARKLY_OPERATIONS).toEqual([
      {
        id: "list_feature_flags",
        path: "/api/v2/flags/{projectKey}",
        collection: true,
      },
      {
        id: "get_feature_flag",
        path: "/api/v2/flags/{projectKey}/{resourceId}",
        collection: false,
      },
    ]);
  });

  it("uses fixed EU/project/environment routing, summary mode, and API version", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              key: "checkout-v2",
              variations: [{ _id: "on", name: "On", value: { secret: 1 } }],
              environments: {
                staging: {
                  on: true,
                  targets: [{ values: ["user@example.com"] }],
                  rules: [{ clauses: [{ values: ["private"] }] }],
                },
              },
            },
          ],
          _links: { next: { href: "/api/v2/flags/project-a?offset=25" } },
        }),
      ),
    );
    const result = await new LaunchDarklyApiAdapter().read(
      credentials,
      "list_feature_flags",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.eu.launchdarkly.com/api/v2/flags/project-a?env=staging&limit=25&offset=0&summary=true",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "api-test-token",
      "LD-API-Version": "20240415",
    });
    expect(JSON.stringify(result)).not.toContain("user@example.com");
    expect(JSON.stringify(result)).not.toContain('"secret"');
    expect(result.pagination.hasNextPage).toBe(true);
  });

  it("pins exact flag reads to the stored environment", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"key":"checkout-v2"}'));
    await new LaunchDarklyApiAdapter().read(credentials, "get_feature_flag", {
      resourceId: "checkout-v2",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://app.eu.launchdarkly.com/api/v2/flags/project-a/checkout-v2?env=staging",
    );
  });

  it("blocks routing, targeting, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new LaunchDarklyApiAdapter();
    await expect(
      adapter.read(credentials, "list_feature_flags", {
        environment: "production",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_feature_flag", { resourceId: "../users" }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() => adapter.read(credentials, "update_flag", {})).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
