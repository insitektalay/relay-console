jest.mock("node:dns/promises", () => ({
  lookup: jest
    .fn()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  MatomoSelfHostedApiAdapter,
  MatomoSelfHostedApiError,
} from "./matomo-self-hosted-api.adapter";
import { MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST } from "./matomo-self-hosted.connector";

const credentials = {
  installationUrl: "https://analytics.example.com/matomo/",
  tokenAuth: "a".repeat(32),
  siteId: 7,
};

describe("Matomo Self-Hosted connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers four approval-gated aggregate reporting tools", () => {
    expect(new MarketplaceConnectorRegistry().get("matomo-self-hosted")).toBe(
      MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
    expect(MATOMO_SELF_HOSTED_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "MATOMO_SELF_HOSTED_TOKEN_AUTH",
          secret: true,
          storedIn: "encrypted_secret",
        }),
      ]),
    );
  });

  it("sends the token only in a fixed POST body and returns selected metrics", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          nb_visits: 12,
          nb_uniq_visitors: 9,
          nb_actions: 30,
          ignored_private_field: "not returned",
        }),
        { status: 200 },
      ),
    );
    const result = await new MatomoSelfHostedApiAdapter().summary(credentials, {
      window: "this_week",
    });
    const [target, options] = fetchMock.mock.calls[0];
    expect(target.toString()).toBe(
      "https://analytics.example.com/matomo/index.php",
    );
    expect(target.toString()).not.toContain(credentials.tokenAuth);
    expect(options?.method).toBe("POST");
    const body = new URLSearchParams(String(options?.body));
    expect(body.get("method")).toBe("VisitsSummary.get");
    expect(body.get("idSite")).toBe("7");
    expect(body.get("period")).toBe("week");
    expect(body.get("token_auth")).toBe(credentials.tokenAuth);
    expect(result).toEqual({
      nb_visits: 12,
      nb_uniq_visitors: 9,
      nb_actions: 30,
    });
  });

  it("bounds top pages and strips query strings from page labels", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            label: "https://shop.example/orders?email=person@example.com",
            nb_visits: 4,
            nb_pageviews: 8,
          },
          { label: "/pricing?campaign=private", nb_visits: 3 },
        ]),
        { status: 200 },
      ),
    );
    const result = await new MatomoSelfHostedApiAdapter().topPages(
      credentials,
      { window: "yesterday", limit: 2 },
    );
    expect(result).toEqual(
      expect.objectContaining({
        count: 2,
        rows: [
          expect.objectContaining({
            label: "https://shop.example/orders",
            nb_visits: 4,
          }),
          expect.objectContaining({ label: "/pricing", nb_visits: 3 }),
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("person@example.com");
  });

  it.each([
    "http://analytics.example.com",
    "https://localhost/matomo",
    "https://127.0.0.1/matomo",
    "https://user:pass@analytics.example.com/matomo",
  ])(
    "rejects an unsafe installation authority: %s",
    async (installationUrl) => {
      await expect(
        new MatomoSelfHostedApiAdapter().health({
          ...credentials,
          installationUrl,
        }),
      ).rejects.toMatchObject<Partial<MatomoSelfHostedApiError>>({
        code: "policy_blocked",
      });
    },
  );

  it("does not expose provider errors or the auth token", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          result: "error",
          message: `token ${credentials.tokenAuth} cannot access idSite=7`,
        }),
        { status: 403 },
      ),
    );
    const promise = new MatomoSelfHostedApiAdapter().countries(credentials, {});
    await expect(promise).rejects.toThrow(
      "Matomo Self-Hosted rejected the bounded reporting request.",
    );
    await expect(promise).rejects.not.toThrow(credentials.tokenAuth);
  });
});
