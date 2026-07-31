import { MarketplaceConnectorRegistry } from "../connector-registry";
import { DonorboxApiAdapter } from "./donorbox-api.adapter";
import { DONORBOX_CONNECTOR_MANIFEST } from "./donorbox.connector";

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("Donorbox Marketplace connector", () => {
  it("registers account email, encrypted key and one bounded campaign read", () => {
    expect(new MarketplaceConnectorRegistry().get("donorbox")).toBe(
      DONORBOX_CONNECTOR_MANIFEST,
    );
    expect(
      DONORBOX_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["DONORBOX_ACCOUNT_EMAIL", "DONORBOX_API_KEY"]);
    expect(DONORBOX_CONNECTOR_MANIFEST.tools).toHaveLength(1);
  });

  it("pins page one, requested bound and Basic Auth while stripping financial data", async () => {
    let url = "";
    let headers = new Headers();
    const adapter = new DonorboxApiAdapter(async (requestUrl, init) => {
      url = String(requestUrl);
      headers = new Headers(init.headers);
      return response([
        {
          id: 42,
          name: "Community Fund",
          slug: "community-fund",
          created_at: "2026-01-01T00:00:00Z",
          goal_amt: "10000",
          total_raised: "5000",
          donations_count: 12,
        },
      ]);
    });
    const result = await adapter.listCampaigns(
      { accountEmail: "team@example.org", apiKey: "secret" },
      { limit: 7 },
    );
    expect(url).toBe(
      "https://donorbox.org/api/v1/campaigns?page=1&per_page=7&order=desc",
    );
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from("team@example.org:secret").toString("base64")}`,
    );
    expect(result.campaigns[0]).toMatchObject({
      campaignId: "42",
      name: "Community Fund",
      slug: "community-fund",
    });
    expect(JSON.stringify(result)).not.toMatch(
      /goal_amt|total_raised|donations_count|10000|5000/,
    );
  });

  it("rejects a missing organization identity before a request", async () => {
    const requester = jest.fn();
    const adapter = new DonorboxApiAdapter(requester);
    await expect(
      adapter.listCampaigns({ accountEmail: "", apiKey: "secret" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    expect(requester).not.toHaveBeenCalled();
  });
});
