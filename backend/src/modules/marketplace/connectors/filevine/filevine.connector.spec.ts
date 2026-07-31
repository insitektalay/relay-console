import { FilevineApiAdapter, FilevineApiError } from "./filevine-api.adapter";
import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";

describe("Filevine connector", () => {
  const manifest = MARKETPLACE_CATALOG.find(({ slug }) => slug === "filevine")!;
  const credentials = {
    accessToken: "test-access-token",
  };

  it("exposes one approval-gated Filevine OAuth authority read", () => {
    expect(manifest.sourceMetadata?.authentication).toMatchObject({
      authorizationUrl: "https://identity.filevine.com/connect/authorize",
      tokenUrl: "https://identity.filevine.com/connect/token",
      scopes: ["openid", "offline_access", "fv.api.gateway.access"],
      refreshTokens: true,
      pkce: false,
    });
    expect(manifest.approvalRequiredActions.map(({ id }) => id)).toEqual([
      "filevine_connection_authority_get",
    ]);
  });

  it("uses one fixed endpoint and discards project data", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [{ projectId: 123, projectName: "Excluded Matter" }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new FilevineApiAdapter(requester).getConnectionAuthority(credentials),
    ).resolves.toEqual({
      authorized: true,
      apiRegion: "us",
      apiVersion: "v2",
      redactionStatus:
        "user-firm-project-matter-document-financial-and-legal-practice-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.filevine.io/v2/projects?limit=1",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: "Bearer test-access-token",
      },
    });
  });

  it("rejects malformed credentials and invalid authority", async () => {
    const requester = jest.fn();
    await expect(
      new FilevineApiAdapter(requester).health({
        accessToken: "bad\ntoken",
      }),
    ).rejects.toBeInstanceOf(FilevineApiError);
    expect(requester).not.toHaveBeenCalled();
    await expect(
      new FilevineApiAdapter(
        jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("preserves rate limits and response bounds", async () => {
    await expect(
      new FilevineApiAdapter(
        jest.fn().mockResolvedValue(new Response("", { status: 429 })),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    await expect(
      new FilevineApiAdapter(
        jest.fn().mockResolvedValue(new Response("1".repeat(65_537))),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
