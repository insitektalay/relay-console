import { PartnerFinanceApiAdapter } from "../partner-finance/partner-finance-api.adapter";
import { MX_CONNECTOR_MANIFEST } from "./mx.connector";

describe("MX connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("keeps mutations behind Safe approval and exposes them in Dangerous mode", () => {
    expect(
      MX_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (x) => x.id,
      ),
    ).toEqual(["mx_full_api"]);
    expect(
      MX_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map((x) => x.id),
    ).toEqual(["mx_read", "mx_full_api"]);
  });
  it("uses Basic auth only on an allowlisted MX API origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ users: [] }), { status: 200 }),
      );
    await new PartnerFinanceApiAdapter().health("mx", {
      MX_API_ORIGIN: "https://int-api.mx.com",
      MX_CLIENT_ID: "client",
      MX_API_KEY: "key",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://int-api.mx.com/users?records_per_page=10",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe(`Basic ${Buffer.from("client:key").toString("base64")}`);
  });
});
