import { PartnerFinanceApiAdapter } from "../partner-finance/partner-finance-api.adapter";
import { FINICITY_CONNECTOR_MANIFEST } from "./finicity.connector";

describe("Finicity connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("keeps mutations behind Safe approval and exposes them in Dangerous mode", () => {
    expect(
      FINICITY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (x) => x.id,
      ),
    ).toEqual(["finicity_full_api"]);
    expect(
      FINICITY_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (x) => x.id,
      ),
    ).toEqual(["finicity_read", "finicity_full_api"]);
  });
  it("mints and attaches the partner token only on the fixed Finicity origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "app-token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ institutions: [] }), { status: 200 }),
      );
    await new PartnerFinanceApiAdapter().health("finicity", {
      FINICITY_API_ORIGIN: "https://api.finicity.com",
      FINICITY_PARTNER_ID: "partner",
      FINICITY_PARTNER_SECRET: "secret",
      FINICITY_APP_KEY: "app",
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.finicity.com/institution/v2/institutions?start=1&limit=1",
    );
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)[
        "Finicity-App-Token"
      ],
    ).toBe("app-token");
  });
});
