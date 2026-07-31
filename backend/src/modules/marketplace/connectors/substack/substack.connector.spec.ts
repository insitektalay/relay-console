import { SubstackApiAdapter, SubstackApiError } from "./substack-api.adapter";
import { SUBSTACK_CONNECTOR_MANIFEST } from "./substack.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Substack connector", () => {
  const credentials = {
    apiToken: "secret-token",
    validationLinkedInHandle: "johndoe",
  };

  it("exposes only the official exact-LinkedIn-handle public lookup", () => {
    expect(SUBSTACK_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: expect.arrayContaining([
        expect.objectContaining({
          name: "SUBSTACK_API_TOKEN",
          secret: true,
          required: true,
        }),
      ]),
    });
    expect(SUBSTACK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "substack.searchProfilesByLinkedIn",
    ]);
    expect(SUBSTACK_CONNECTOR_MANIFEST.tools[0].approvalRequired).toBe(false);
  });

  it("uses the fixed documented path and returns bounded public fields", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        results: [
          {
            identityHandle: "writer",
            profileUrl: "https://substack.com/@writer",
            leaderboardStatus: {
              rank: 15,
              publicationName: "Tech Weekly",
              label: "Top in Technology",
              ranking: "paid",
            },
            bestsellerTier: "bestseller",
            roughNumFreeSubscribers: 5000,
            followerCount: 1250,
          },
          { identityHandle: "bad", profileUrl: "https://evil.example/profile" },
        ],
      }),
    );
    const adapter = new SubstackApiAdapter(requester, () => new Date(0));
    const result = await adapter.searchProfilesByLinkedIn(
      credentials,
      "john-doe",
    );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://substack.com/profile/search/linkedin/john-doe",
    );
    expect(requester.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer secret-token",
    );
    expect(result.results[0]).toMatchObject({
      identityHandle: "writer",
      leaderboardRank: 15,
      roughFreeSubscribers: 5000,
    });
    expect(result.results[1].profileUrl).toBeNull();
  });

  it("rejects path injection, oversized responses, and bursts", async () => {
    const adapter = new SubstackApiAdapter(
      jest.fn().mockResolvedValue(json({ results: [] })),
      () => new Date(0),
    );
    await expect(
      adapter.searchProfilesByLinkedIn(credentials, "../settings"),
    ).rejects.toBeInstanceOf(SubstackApiError);
    await adapter.searchProfilesByLinkedIn(credentials, "johndoe");
    await expect(
      adapter.searchProfilesByLinkedIn(credentials, "janedoe"),
    ).rejects.toMatchObject({ code: "provider_rate_limited" });
    const oversized = new SubstackApiAdapter(
      jest
        .fn()
        .mockResolvedValue(
          new Response("x", { headers: { "content-length": "1000001" } }),
        ),
      () => new Date(0),
    );
    await expect(oversized.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
