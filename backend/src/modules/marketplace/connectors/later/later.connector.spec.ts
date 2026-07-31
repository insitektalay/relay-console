import { LaterApiAdapter, LaterApiError } from "./later-api.adapter";
import { LATER_CONNECTOR_MANIFEST } from "./later.connector";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
describe("Later connector", () => {
  const credentials = { clientId: "client", clientSecret: "secret" };
  it("uses customer-owned server credentials and three approval-gated reads", () => {
    expect(LATER_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      LATER_CONNECTOR_MANIFEST.auth.credentialSchema.map((v) => v.name),
    ).toEqual(["LATER_CLIENT_ID", "LATER_CLIENT_SECRET"]);
    expect(LATER_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      LATER_CONNECTOR_MANIFEST.tools.every((v) => v.approvalRequired),
    ).toBe(true);
  });
  it("uses fixed origins, metrics, first pages, and strips identity, content, and financial data", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(json({ jwt: "jwt" }))
      .mockResolvedValueOnce(
        json({
          data: { instanceIds: ["instance_abc"], name: "private" },
          nextCursor: "secret",
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: {
            engagements: 12,
            impressions: 40,
            reach: 30,
            estimatedRoi: 9,
            cost: 5,
          },
        }),
      )
      .mockResolvedValueOnce(
        json({
          data: [
            {
              campaignId: "campaign_1",
              campaignName: "private",
              engagements: 5,
              impressions: 9,
              reach: 8,
              affiliateLinksSales: 7,
            },
          ],
          nextCursor: "secret",
        }),
      );
    const api = new LaterApiAdapter(requester);
    expect(await api.instances(credentials)).toEqual({
      instanceIds: ["instance_abc"],
      nextCursorExcluded: true,
    });
    expect(
      await api.instancePerformance(credentials, "2026-06-01", "2026-06-30"),
    ).toMatchObject({
      metrics: { engagements: 12, impressions: 40, reach: 30 },
    });
    expect(
      await api.campaignPerformance(
        credentials,
        "instance_abc",
        "2026-06-01",
        "2026-06-30",
      ),
    ).toMatchObject({
      campaigns: [
        {
          campaignId: "campaign_1",
          metrics: { engagements: 5, impressions: 9, reach: 8 },
        },
      ],
      nextCursorExcluded: true,
    });
    expect(String(requester.mock.calls[0][0])).toBe(LaterApiAdapter.tokenUrl);
    expect(JSON.parse(String(requester.mock.calls[0][1].body))).toEqual({
      clientId: "client",
      clientSecret: "secret",
    });
    for (const call of requester.mock.calls.slice(1)) {
      const url = new URL(String(call[0]));
      expect(url.origin).toBe(LaterApiAdapter.apiOrigin);
      expect(
        url.searchParams
          .getAll("metrics")
          .every((v) => ["engagements", "impressions", "reach"].includes(v)),
      ).toBe(true);
    }
  });
  it("rejects unsafe IDs, oversized dates, missing credentials, and provider limits", async () => {
    const api = new LaterApiAdapter(jest.fn());
    await expect(
      api.campaignPerformance(
        credentials,
        "../users",
        "2026-06-01",
        "2026-06-02",
      ),
    ).rejects.toBeInstanceOf(LaterApiError);
    await expect(
      api.instancePerformance(credentials, "2026-01-01", "2026-02-02"),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      api.instances({ clientId: "", clientSecret: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    const failed = new LaterApiAdapter(
      jest.fn().mockResolvedValue(json({ type: "ANL_00429" }, 429)),
    );
    await expect(failed.instances(credentials)).rejects.toMatchObject({
      code: "provider_rate_limited",
    });
  });
});
