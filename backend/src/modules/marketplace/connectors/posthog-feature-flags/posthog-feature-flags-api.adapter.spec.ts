import {
  PostHogFeatureFlagsApiAdapter,
  type PostHogFeatureFlagsCredentials,
} from "./posthog-feature-flags-api.adapter";
import { POSTHOG_FEATURE_FLAGS_OPERATIONS } from "./posthog-feature-flags-operation-registry";

describe("PostHogFeatureFlagsApiAdapter", () => {
  const credentials: PostHogFeatureFlagsCredentials = {
    personalApiKey: "phx_test_secret",
    region: "eu",
    projectId: "123",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins only the official feature-flag list and exact read routes", () => {
    expect(POSTHOG_FEATURE_FLAGS_OPERATIONS).toEqual([
      {
        id: "list_active_feature_flags",
        method: "GET",
        path: "/api/projects/{projectId}/feature_flags/",
        collection: true,
      },
      {
        id: "get_feature_flag",
        method: "GET",
        path: "/api/projects/{projectId}/feature_flags/{resourceId}/",
        collection: false,
      },
    ]);
  });

  it("binds bounded active lists to the stored project and fixed EU origin", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 9,
              key: "checkout-v2",
              filters: {
                groups: [{ properties: [{ value: "private" }] }],
                multivariate: {
                  variants: [
                    { key: "control", rollout_percentage: 50, payload: "x" },
                  ],
                },
              },
            },
          ],
        }),
      ),
    );
    const result = await new PostHogFeatureFlagsApiAdapter().read(
      credentials,
      "list_active_feature_flags",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://eu.posthog.com/api/projects/123/feature_flags/?limit=25&offset=0&active=true",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer phx_test_secret",
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(JSON.stringify(result)).not.toContain("payload");
  });

  it("pins exact integer reads and excludes collection parameters", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response('{"id":9,"key":"checkout-v2"}'));
    await new PostHogFeatureFlagsApiAdapter().read(
      credentials,
      "get_feature_flag",
      { resourceId: 9 },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://eu.posthog.com/api/projects/123/feature_flags/9/",
    );
  });

  it("blocks routing, targeting, invalid IDs, and arbitrary operations before network", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new PostHogFeatureFlagsApiAdapter();
    await expect(
      adapter.read(credentials, "list_active_feature_flags", {
        projectId: "999",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.read(credentials, "get_feature_flag", {
        resourceId: "../persons",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(() =>
      adapter.read(credentials, "update_feature_flag", {}),
    ).toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
