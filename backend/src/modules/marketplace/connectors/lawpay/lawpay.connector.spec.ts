import { LawPayApiAdapter, LawPayApiError } from "./lawpay-api.adapter";
import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";

describe("LawPay connector", () => {
  const manifest = MARKETPLACE_CATALOG.find(({ slug }) => slug === "lawpay")!;
  const credentials = {
    accessToken: "test-access-token",
  };

  it("exposes one approval-gated LawPay OAuth authority read", () => {
    expect(manifest.sourceMetadata?.authentication).toMatchObject({
      authorizationUrl: "https://secure.lawpay.com/oauth/authorize",
      tokenUrl: "https://api.8am.com/oauth/token",
      scopes: ["payments"],
      refreshTokens: false,
      pkce: false,
    });
    expect(manifest.approvalRequiredActions.map(({ id }) => id)).toEqual([
      "lawpay_connection_authority_get",
    ]);
  });

  it("uses one fixed endpoint and discards merchant identity and keys", async () => {
    const requester = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          application: "Relay Test",
          user: { email: "excluded@example.com", abilities: ["charge"] },
          merchant: { name: "Excluded Firm", country: "US" },
          test_accounts: [
            {
              id: "acct_test",
              public_key: "m_public",
              secret_key: "secret-excluded",
              trust_account: "true",
            },
          ],
          live_accounts: [],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new LawPayApiAdapter(requester).getConnectionAuthority(credentials),
    ).resolves.toEqual({
      authorized: true,
      platform: "8am-lawpay",
      apiVersion: "v1",
      redactionStatus:
        "merchant-identity-account-keys-trust-payment-and-legal-practice-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.8am.com/gateway-credentials",
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
      new LawPayApiAdapter(requester).health({
        accessToken: "bad\ntoken",
      }),
    ).rejects.toBeInstanceOf(LawPayApiError);
    expect(requester).not.toHaveBeenCalled();
    await expect(
      new LawPayApiAdapter(
        jest
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ application: "bad" })),
          ),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("preserves rate limits and response bounds", async () => {
    await expect(
      new LawPayApiAdapter(
        jest.fn().mockResolvedValue(new Response("", { status: 429 })),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    await expect(
      new LawPayApiAdapter(
        jest.fn().mockResolvedValue(new Response("1".repeat(65_537))),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
