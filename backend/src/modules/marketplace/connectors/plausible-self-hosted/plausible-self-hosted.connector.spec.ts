jest.mock("node:dns/promises", () => ({
  lookup: jest
    .fn()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  PlausibleSelfHostedApiAdapter,
  PlausibleSelfHostedApiError,
} from "./plausible-self-hosted-api.adapter";
import { PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST } from "./plausible-self-hosted.connector";

const credentials = {
  installationUrl: "https://analytics.example.com/plausible/",
  apiKey: "p".repeat(32),
  siteId: "shop.example.com",
};

describe("Plausible Self-Hosted connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers four approval-gated fixed Stats API tools", () => {
    expect(
      new MarketplaceConnectorRegistry().get("plausible-self-hosted"),
    ).toBe(PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST);
    expect(PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      PLAUSIBLE_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins the v2 endpoint, site, metrics and recent window", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [{ dimensions: [], metrics: [10, 8, 20, 2.5, 40, 90] }],
          }),
          { status: 200 },
        ),
      );
    const result = await new PlausibleSelfHostedApiAdapter().overview(
      credentials,
      { window: "7d" },
    );
    const [target, options] = fetchMock.mock.calls[0];
    expect(target.toString()).toBe(
      "https://analytics.example.com/plausible/api/v2/query",
    );
    expect(options?.headers).toEqual(
      expect.objectContaining({
        Authorization: `Bearer ${credentials.apiKey}`,
      }),
    );
    const body = JSON.parse(String(options?.body));
    expect(body).toEqual(
      expect.objectContaining({
        site_id: "shop.example.com",
        date_range: "7d",
        dimensions: [],
        filters: [],
        pagination: { limit: 1, offset: 0 },
      }),
    );
    expect(result).toEqual({
      visitors: 10,
      visits: 8,
      pageviews: 20,
      views_per_visit: 2.5,
      bounce_rate: 40,
      visit_duration: 90,
    });
  });

  it("bounds page results and strips query strings", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              dimensions: ["/orders?email=person@example.com"],
              metrics: [4, 8, 20, 30],
            },
            { dimensions: ["/pricing#private"], metrics: [3, 5, 10, 40] },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new PlausibleSelfHostedApiAdapter().topPages(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual(
      expect.objectContaining({
        count: 2,
        rows: [
          expect.objectContaining({
            dimensions: { page: "/orders" },
            metrics: expect.objectContaining({ visitors: 4 }),
          }),
          expect.objectContaining({
            dimensions: { page: "/pricing" },
            metrics: expect.objectContaining({ visitors: 3 }),
          }),
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("person@example.com");
  });

  it.each([
    "http://analytics.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://user:pass@analytics.example.com",
  ])(
    "rejects an unsafe installation authority: %s",
    async (installationUrl) => {
      await expect(
        new PlausibleSelfHostedApiAdapter().health({
          ...credentials,
          installationUrl,
        }),
      ).rejects.toMatchObject<Partial<PlausibleSelfHostedApiError>>({
        code: "policy_blocked",
      });
    },
  );

  it("returns secret-safe provider errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: `key ${credentials.apiKey} is invalid` }),
          { status: 401 },
        ),
      );
    const promise = new PlausibleSelfHostedApiAdapter().sources(
      credentials,
      {},
    );
    await expect(promise).rejects.toThrow(
      "Plausible Self-Hosted rejected the bounded stats query.",
    );
    await expect(promise).rejects.not.toThrow(credentials.apiKey);
  });
});
