import {
  SmokeballApiAdapter,
  SmokeballApiError,
} from "./smokeball-api.adapter";
import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";

describe("Smokeball connector", () => {
  const manifest = MARKETPLACE_CATALOG.find(
    ({ slug }) => slug === "smokeball",
  )!;
  const credentials = {
    accessToken: "test-access-token",
    apiKey: "test-api-key",
  };

  it("exposes one approval-gated US OAuth authority read", () => {
    expect(manifest.sourceMetadata?.authentication).toMatchObject({
      authorizationUrl: "https://auth.smokeball.com/oauth2/authorize",
      tokenUrl: "https://auth.smokeball.com/oauth2/token",
      scopes: [],
      refreshTokens: true,
      pkce: true,
    });
    expect(manifest.approvalRequiredActions.map(({ id }) => id)).toEqual([
      "smokeball_connection_authority_get",
    ]);
  });

  it("uses one fixed endpoint and discards firm identity", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "f4ff1eff-b7fe-4d46-8e46-01d985838d76",
          name: "Excluded Firm",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new SmokeballApiAdapter(requester).getConnectionAuthority(credentials),
    ).resolves.toEqual({
      authorized: true,
      apiRegion: "us",
      apiVersion: "v1",
      redactionStatus:
        "firm-identity-client-matter-document-communication-and-financial-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.smokeball.com/firm",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: {
        Authorization: "Bearer test-access-token",
        "x-api-key": "test-api-key",
      },
    });
  });

  it("rejects malformed credentials and invalid authority", async () => {
    const requester = jest.fn();
    await expect(
      new SmokeballApiAdapter(requester).health({
        accessToken: "bad\ntoken",
        apiKey: "test-api-key",
      }),
    ).rejects.toBeInstanceOf(SmokeballApiError);
    expect(requester).not.toHaveBeenCalled();
    await expect(
      new SmokeballApiAdapter(
        jest
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ id: "bad" }))),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("preserves rate limits and response bounds", async () => {
    await expect(
      new SmokeballApiAdapter(
        jest.fn().mockResolvedValue(new Response("", { status: 429 })),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    await expect(
      new SmokeballApiAdapter(
        jest.fn().mockResolvedValue(new Response("1".repeat(65_537))),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
