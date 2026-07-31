import {
  PracticePantherApiAdapter,
  PracticePantherApiError,
} from "./practicepanther-api.adapter";
import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";

describe("PracticePanther connector", () => {
  const manifest = MARKETPLACE_CATALOG.find(
    ({ slug }) => slug === "practicepanther",
  )!;
  const credentials = { accessToken: "test-access-token" };
  it("exposes one approval-gated scope-less OAuth authority read", () => {
    expect(manifest.sourceMetadata?.authentication).toMatchObject({
      authorizationUrl: "https://app.practicepanther.com/oauth/authorize",
      tokenUrl: "https://app.practicepanther.com/oauth/token",
      scopes: [],
      refreshTokens: true,
      pkce: false,
    });
    expect(manifest.approvalRequiredActions.map(({ id }) => id)).toEqual([
      "practicepanther_connection_authority_get",
    ]);
  });
  it("uses one fixed endpoint and discards the count", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(new Response("42", { status: 200 }));
    await expect(
      new PracticePantherApiAdapter(requester).getConnectionAuthority(
        credentials,
      ),
    ).resolves.toEqual({
      authorized: true,
      apiVersion: "v1",
      redactionStatus:
        "identity-firm-legal-practice-time-and-financial-data-excluded",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://app.practicepanther.com/api/TimeEntry/$count",
    );
    expect(requester.mock.calls[0][1]).toMatchObject({
      method: "GET",
      redirect: "error",
    });
  });
  it("rejects malformed tokens and invalid authority", async () => {
    const requester = jest.fn();
    await expect(
      new PracticePantherApiAdapter(requester).health({
        accessToken: "bad\ntoken",
      }),
    ).rejects.toBeInstanceOf(PracticePantherApiError);
    expect(requester).not.toHaveBeenCalled();
    await expect(
      new PracticePantherApiAdapter(
        jest.fn().mockResolvedValue(new Response("not-a-count")),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
  it("preserves rate limits and response bounds", async () => {
    await expect(
      new PracticePantherApiAdapter(
        jest.fn().mockResolvedValue(new Response("", { status: 429 })),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    await expect(
      new PracticePantherApiAdapter(
        jest.fn().mockResolvedValue(new Response("1".repeat(65_537))),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
