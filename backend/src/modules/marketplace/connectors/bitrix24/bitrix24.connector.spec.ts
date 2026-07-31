import { BITRIX24_CONNECTOR_MANIFEST } from "./bitrix24.connector";

describe("Bitrix24 connector manifest", () => {
  it("publishes one encrypted incoming-webhook credential and three typed reads", () => {
    expect(BITRIX24_CONNECTOR_MANIFEST).toMatchObject({
      slug: "bitrix24",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(BITRIX24_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "BITRIX24_WEBHOOK_URL",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      }),
    ]);
    expect(BITRIX24_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "bitrix24.getProfile",
      "bitrix24.listDeals",
      "bitrix24.getDeal",
    ]);
  });

  it("requires Safe approval for every private read and preserves hard guards in Dangerous mode", () => {
    const [safe, dangerous] = BITRIX24_CONNECTOR_MANIFEST.approvalProfiles;
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual([
      "bitrix24_profile_get",
      "bitrix24_deal_list",
      "bitrix24_deal_get",
    ]);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual([
      "bitrix24_profile_get",
      "bitrix24_deal_list",
      "bitrix24_deal_get",
    ]);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "bitrix24_record_mutation",
        "bitrix24_raw_rest",
        "bitrix24_untrusted_host",
      ]),
    );
  });
});
