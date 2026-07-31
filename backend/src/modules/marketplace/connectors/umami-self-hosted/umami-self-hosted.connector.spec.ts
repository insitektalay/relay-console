jest.mock("node:dns/promises", () => ({
  lookup: jest
    .fn()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  UmamiSelfHostedApiAdapter,
  UmamiSelfHostedApiError,
} from "./umami-self-hosted-api.adapter";
import { UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST } from "./umami-self-hosted.connector";

const credentials = {
  installationUrl: "https://analytics.example.com/umami/",
  username: "relay-reader",
  password: "correct horse battery staple",
  websiteId: "11111111-2222-4333-8444-555555555555",
};

const login = () =>
  new Response(JSON.stringify({ token: "t".repeat(64), user: { id: "u" } }), {
    status: 200,
  });

describe("Umami Self-Hosted connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers four approval-gated fixed analytics tools", () => {
    expect(new MarketplaceConnectorRegistry().get("umami-self-hosted")).toBe(
      UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST,
    );
    expect(UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      UMAMI_SELF_HOSTED_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("logs in only at the exact installation and pins stats to one website", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pageviews: 20,
            visitors: 10,
            visits: 12,
            bounces: 3,
            totaltime: 90,
          }),
          { status: 200 },
        ),
      );
    const result = await new UmamiSelfHostedApiAdapter().stats(credentials, {
      window: "7d",
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://analytics.example.com/umami/api/auth/login",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      username: credentials.username,
      password: credentials.password,
    });
    const target = new URL(fetchMock.mock.calls[1][0].toString());
    expect(target.pathname).toBe(
      `/umami/api/websites/${credentials.websiteId}/stats`,
    );
    expect(target.searchParams.get("startAt")).toMatch(/^\d+$/);
    expect(target.searchParams.get("endAt")).toMatch(/^\d+$/);
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual(
      expect.objectContaining({ Authorization: `Bearer ${"t".repeat(64)}` }),
    );
    expect(result).toEqual({
      pageviews: 20,
      visitors: 10,
      visits: 12,
      bounces: 3,
      totaltime: 90,
    });
  });

  it("bounds top pages and strips query strings", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { x: "/orders?email=person@example.com", y: 8 },
            { x: "/pricing#private", y: 5 },
          ]),
          { status: 200 },
        ),
      );
    const result = await new UmamiSelfHostedApiAdapter().topPages(credentials, {
      limit: 2,
    });
    expect(result).toEqual(
      expect.objectContaining({
        count: 2,
        rows: [
          { path: "/orders", visitors: 8 },
          { path: "/pricing", visitors: 5 },
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toContain("person@example.com");
  });

  it("uses the fixed active endpoint without agent-supplied query parameters", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ visitors: 4 }), { status: 200 }),
      );
    await expect(
      new UmamiSelfHostedApiAdapter().activeVisitors(credentials),
    ).resolves.toEqual({ visitors: 4 });
    expect(fetchMock.mock.calls[1][0].toString()).toBe(
      `https://analytics.example.com/umami/api/websites/${credentials.websiteId}/active`,
    );
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
        new UmamiSelfHostedApiAdapter().health({
          ...credentials,
          installationUrl,
        }),
      ).rejects.toMatchObject<Partial<UmamiSelfHostedApiError>>({
        code: "policy_blocked",
      });
    },
  );

  it("returns secret-safe authentication errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: `password ${credentials.password} invalid` }),
          { status: 401 },
        ),
      );
    const promise = new UmamiSelfHostedApiAdapter().stats(credentials, {});
    await expect(promise).rejects.toThrow(
      "Umami Self-Hosted rejected the encrypted login credentials.",
    );
    await expect(promise).rejects.not.toThrow(credentials.password);
  });
});
