import { validate as validateUuid } from "uuid";
import { PartnerFinanceApiAdapter } from "../partner-finance/partner-finance-api.adapter";
import { ETORO_CONNECTOR_MANIFEST } from "./etoro.connector";

describe("eToro connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("keeps trades and mutations behind Safe approval and exposes them in Dangerous mode", () => {
    expect(
      ETORO_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (x) => x.id,
      ),
    ).toEqual(["etoro_full_api"]);
    expect(
      ETORO_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (x) => x.id,
      ),
    ).toEqual(["etoro_read", "etoro_full_api"]);
  });
  it("attaches both keys and a fresh UUID only to the fixed eToro origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ watchlists: [] }), { status: 200 }),
      );
    await new PartnerFinanceApiAdapter().health("etoro", {
      ETORO_PUBLIC_API_KEY: "public",
      ETORO_USER_KEY: "user",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://public-api.etoro.com/api/v1/watchlists",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers["x-api-key"]).toBe("public");
    expect(headers["x-user-key"]).toBe("user");
    expect(validateUuid(headers["x-request-id"])).toBe(true);
  });
});
