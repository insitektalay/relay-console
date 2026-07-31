import { MarketplaceConnectorRegistry } from "../connector-registry";
import { ZephyrScaleApiAdapter } from "./zephyr-scale-api.adapter";
import { ZEPHYR_SCALE_CONNECTOR_MANIFEST } from "./zephyr-scale.connector";

describe("Zephyr Scale connector", () => {
  it("registers the complete Safe and Dangerous tool surface", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("zephyr-scale")).toBe(ZEPHYR_SCALE_CONNECTOR_MANIFEST);
    expect(ZEPHYR_SCALE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["zephyrScale.listTestCases", "zephyrScale.getTestCase", "zephyrScale.listTestCycles", "zephyrScale.request"]);
    expect(ZEPHYR_SCALE_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("pins reads to the selected region and project", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe("https://eu.api.zephyrscale.smartbear.com/v2/testcases?projectKey=RELAY&maxResults=5&startAt=0");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer zephyr-scale-token-value");
      return new Response(JSON.stringify({ values: [{ key: "RELAY-T1" }], total: 1, startAt: 0, maxResults: 5 }), { status: 200 });
    });
    const adapter = new ZephyrScaleApiAdapter(requester);
    await expect(adapter.listTestCases({ apiToken: "zephyr-scale-token-value", region: "EU", projectKey: "RELAY" }, { limit: 5 })).resolves.toEqual({ testCases: [{ key: "RELAY-T1" }], pagination: { startAt: 0, maxResults: 5, total: 1 } });
  });

  it("rejects cross-project keys and origin escape", async () => {
    const adapter = new ZephyrScaleApiAdapter();
    const credentials = { apiToken: "zephyr-scale-token-value", region: "US", projectKey: "RELAY" };
    await expect(adapter.getTestCase(credentials, "OTHER-T1")).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "GET", path: "/../tokens" })).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
