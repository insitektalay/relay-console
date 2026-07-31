import { PartnerFinanceApiAdapter } from "../partner-finance/partner-finance-api.adapter";
import { PLAID_LINK_CONNECTOR_MANIFEST } from "./plaid-link.connector";

describe("Plaid Link connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("keeps mutations behind Safe approval and exposes them in Dangerous mode", () => {
    expect(
      PLAID_LINK_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (x) => x.id,
      ),
    ).toEqual(["plaid_link_full_api"]);
    expect(
      PLAID_LINK_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (x) => x.id,
      ),
    ).toEqual(["plaid_link_read", "plaid_link_full_api"]);
  });
  it("injects Plaid credentials server-side and redacts returned tokens", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ item: { item_id: "item" }, access_token: "never" }),
          { status: 200 },
        ),
      );
    const result = await new PartnerFinanceApiAdapter().health("plaid-link", {
      PLAID_API_ORIGIN: "https://sandbox.plaid.com",
      PLAID_CLIENT_ID: "client",
      PLAID_SECRET: "secret",
      PLAID_ACCESS_TOKEN: "access",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://sandbox.plaid.com/item/get",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      client_id: "client",
      secret: "secret",
      access_token: "access",
    });
    expect(result).toEqual({
      item: { item_id: "item" },
      access_token: "[redacted]",
    });
  });
});
