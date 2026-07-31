import {
  MetricoolApiAdapter,
  MetricoolApiError,
} from "./metricool-api.adapter";
import { METRICOOL_CONNECTOR_MANIFEST } from "./metricool.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Metricool connector", () => {
  const credentials = {
    userToken: "secret-user-token",
    userId: "42001",
    blogId: "70002",
  };

  it("exposes only two approval-gated bounded reads", () => {
    expect(METRICOOL_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(METRICOOL_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(
      ["metricool.listBrands", "metricool.listConnectedNetworks"],
    );
    expect(
      METRICOOL_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("validates the exact brand with fixed origin and X-Mc-Auth", async () => {
    const requester = jest
      .fn()
      .mockResolvedValue(json([{ id: 70002, name: "Private brand" }]));
    await expect(
      new MetricoolApiAdapter(requester).health(credentials),
    ).resolves.toEqual({
      apiOrigin: "https://app.metricool.com/api",
      userId: "42001",
      blogId: "70002",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://app.metricool.com/api/admin/simpleProfiles?userId=42001&blogId=70002",
    );
    expect(requester.mock.calls[0][1].headers["X-Mc-Auth"]).toBe(
      "secret-user-token",
    );
  });

  it("lists at most twenty-five brand IDs without identity fields", async () => {
    const requester = jest.fn().mockResolvedValue(
      json([
        {
          blogId: "70002",
          name: "Private brand",
          url: "https://private.example",
          ownerEmail: "owner@example.test",
        },
      ]),
    );
    const result = await new MetricoolApiAdapter(requester).listBrands(
      credentials,
    );
    expect(result.brands).toEqual([{ blogId: "70002" }]);
    expect(JSON.stringify(result)).not.toMatch(/Private|example|owner/);
  });

  it("returns network types without handles, profile IDs, or content", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        instagram: {
          connected: true,
          username: "private_handle",
          profileId: "private-profile",
        },
        linkedin: { active: false, name: "Private page" },
      }),
    );
    const result = await new MetricoolApiAdapter(
      requester,
    ).listConnectedNetworks(credentials);
    expect(result.networks).toEqual([
      { network: "instagram", connected: true },
      { network: "linkedin", connected: false },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private|handle|page/i);
  });

  it("rejects invalid IDs and tokens without access to the bound brand", async () => {
    await expect(
      new MetricoolApiAdapter(jest.fn()).listBrands({
        ...credentials,
        blogId: "../other",
      }),
    ).rejects.toBeInstanceOf(MetricoolApiError);
    const crossBrand = new MetricoolApiAdapter(
      jest.fn().mockResolvedValue(json([{ id: "99999" }])),
    );
    await expect(crossBrand.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
  });
});
