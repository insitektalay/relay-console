import { PartnerFinanceApiAdapter } from "../partner-finance/partner-finance-api.adapter";
import { YODLEE_FASTLINK_CONNECTOR_MANIFEST } from "./yodlee-fastlink.connector";

describe("Yodlee FastLink connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("publishes customer-owned credentials with complete Safe and Dangerous policy", () => {
    expect(YODLEE_FASTLINK_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      YODLEE_FASTLINK_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (x) => x.id,
      ),
    ).toEqual(["yodlee_fastlink_full_api"]);
    expect(
      YODLEE_FASTLINK_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (x) => x.id,
      ),
    ).toEqual(["yodlee_fastlink_read", "yodlee_fastlink_full_api"]);
  });
  it("mints a user token server-side and never accepts credential fields from a tool", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "short-lived" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ account: [] }), { status: 200 }),
      );
    const api = new PartnerFinanceApiAdapter();
    await expect(
      api.read(
        "yodlee-fastlink",
        {
          YODLEE_API_ORIGIN: "https://sandbox.api.yodlee.com/ysl",
          YODLEE_CLIENT_ID: "client",
          YODLEE_CLIENT_SECRET: "secret",
          YODLEE_LOGIN_NAME: "relay-user",
        },
        { path: "/accounts", query: { top: 1 } },
      ),
    ).resolves.toEqual({ account: [] });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://sandbox.api.yodlee.com/ysl/accounts?top=1",
    );
    expect(
      (fetchMock.mock.calls[1][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer short-lived");
    await expect(
      api.read(
        "yodlee-fastlink",
        {
          YODLEE_API_ORIGIN: "https://sandbox.api.yodlee.com/ysl",
          YODLEE_CLIENT_ID: "client",
          YODLEE_CLIENT_SECRET: "secret",
          YODLEE_LOGIN_NAME: "relay-user",
        },
        { path: "/accounts", json: { accessToken: "no" } },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
