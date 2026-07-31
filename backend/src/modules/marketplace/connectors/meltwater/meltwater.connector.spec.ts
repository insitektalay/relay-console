import {
  MeltwaterApiAdapter,
  MeltwaterApiError,
} from "./meltwater-api.adapter";
import { MELTWATER_CONNECTOR_MANIFEST } from "./meltwater.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Meltwater connector", () => {
  const credentials = { apiToken: "test-token" };

  it("exposes only two approval-gated reads", () => {
    expect(MELTWATER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["meltwater.getApiUsage", "meltwater.listSearches"],
    );
    expect(
      MELTWATER_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("validates the fixed origin and apikey header", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(json({ count: 2, units: "hour", time_series: [] }));
    await expect(
      new MeltwaterApiAdapter(requester).health(credentials),
    ).resolves.toEqual({ apiOrigin: "https://api.meltwater.com" });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.meltwater.com/v3/usage/me/requests?period=24hours",
    );
    expect(requester.mock.calls[0][1].headers).toMatchObject({
      apikey: "test-token",
    });
  });

  it("redacts token and endpoint-level usage details", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        count: 7,
        units: "hour",
        token_id: "secret-token-id",
        time_series: [
          { timestamp: "2026-07-18T00:00:00Z", calls: { private: 7 } },
        ],
      }),
    );
    const result = await new MeltwaterApiAdapter(requester).getUsage(
      credentials,
    );
    expect(result).toMatchObject({
      period: "24hours",
      count: 7,
      units: "hour",
      timeSeriesPointCount: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(/secret-token-id|private/);
  });

  it("returns only bounded search IDs and update timestamps", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        searches: [
          {
            id: 12345,
            updated: "2026-07-18T00:00:00.000Z",
            name: "Private brand watch",
            query: { boolean: "secret keyword" },
          },
        ],
      }),
    );
    const result = await new MeltwaterApiAdapter(requester).listSearches(
      credentials,
    );
    expect(result.searches).toEqual([
      { searchId: "12345", updatedAt: "2026-07-18T00:00:00.000Z" },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/Private|secret keyword/);
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.meltwater.com/v3/searches",
    );
  });

  it("rejects missing credentials and preserves provider rate limits", async () => {
    await expect(
      new MeltwaterApiAdapter(jest.fn()).getUsage({ apiToken: "" }),
    ).rejects.toBeInstanceOf(MeltwaterApiError);
    await expect(
      new MeltwaterApiAdapter(
        jest.fn().mockResolvedValue(json({}, 429)),
      ).getUsage(credentials),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
