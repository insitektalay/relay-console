import { CloseApiAdapter } from "./close-api.adapter";

const credentials = {
  accessToken: "secret-token",
  organizationId: "orga_abc123",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("CloseApiAdapter", () => {
  it("uses fixed bounded fields and strips private Opportunity data", async () => {
    const request = jest.fn(async () =>
      response({
        data: [
          {
            id: "oppo_123",
            organization_id: "orga_abc123",
            status_label: "Active",
            value: 5000,
            confidence: 75,
            lead_name: "Private lead",
            note: "Private note",
            custom: { secret: true },
          },
        ],
      }),
    );
    const result = await new CloseApiAdapter(request).listOpportunities(
      credentials,
      { limit: 10 },
    );
    const url = new URL((request.mock.calls[0] as unknown as [string])[0]);
    expect(url.origin).toBe("https://api.close.com");
    expect(url.pathname).toBe("/api/v1/opportunity/");
    expect(url.searchParams.get("_limit")).toBe("10");
    expect(url.searchParams.get("_skip")).toBe("0");
    expect(url.searchParams.get("_order_by")).toBe("-date_updated");
    expect(url.searchParams.get("query")).toBeNull();
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(result.opportunities).toHaveLength(1);
  });

  it("rejects invalid IDs and cross-organization records", async () => {
    const adapter = new CloseApiAdapter(async () =>
      response({ id: "oppo_123", organization_id: "orga_other" }),
    );
    await expect(
      adapter.getOpportunity(credentials, { opportunityId: "../../users" }),
    ).rejects.toMatchObject({ code: "close_opportunity_id_invalid" });
    await expect(
      adapter.getOpportunity(credentials, { opportunityId: "oppo_123" }),
    ).rejects.toMatchObject({ code: "close_organization_binding_mismatch" });
  });

  it("maps provider failures without exposing response bodies", async () => {
    const adapter = new CloseApiAdapter(async () =>
      response({ error: "secret provider detail" }, 403),
    );
    await expect(adapter.getOrganization(credentials)).rejects.toMatchObject({
      code: "close_permission_denied",
      message: "Close API request failed.",
    });
  });
});
