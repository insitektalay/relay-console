import { MarketplaceConnectorRegistry } from "../connector-registry";
import { BENCHMARK_EMAIL_CONNECTOR_MANIFEST } from "./benchmark-email.connector";

describe("Benchmark Email connector manifest", () => {
  it("registers only two selected bounded reads", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("benchmark-email")).toBe(
      BENCHMARK_EMAIL_CONNECTOR_MANIFEST,
    );
    expect(
      BENCHMARK_EMAIL_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "benchmarkEmail.getContactSummary",
      "benchmarkEmail.getCampaignSummary",
    ]);
    expect(BENCHMARK_EMAIL_CONNECTOR_MANIFEST.auth.type).toBe("custom");
    expect(
      BENCHMARK_EMAIL_CONNECTOR_MANIFEST.tools.every(
        (tool) =>
          tool.action === "read" &&
          tool.inputSchema.additionalProperties === false,
      ),
    ).toBe(true);
  });
});
