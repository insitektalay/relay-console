import { STREAK_CONNECTOR_MANIFEST } from "./streak.connector";

describe("Streak connector manifest", () => {
  it("publishes one encrypted key and four typed reads", () => {
    expect(STREAK_CONNECTOR_MANIFEST).toMatchObject({
      slug: "streak",
      connectorType: "native_clawchat",
      auth: { type: "api_key" },
    });
    expect(STREAK_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "STREAK_API_KEY",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      }),
    ]);
    expect(STREAK_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "streak.getCurrentUser",
      "streak.getPipeline",
      "streak.listBoxes",
      "streak.getBox",
    ]);
  });

  it("requires Safe approval and preserves hard blocks in Dangerous mode", () => {
    const [safe, dangerous] = STREAK_CONNECTOR_MANIFEST.approvalProfiles;
    const reads = [
      "streak_user_get",
      "streak_pipeline_get",
      "streak_box_list",
      "streak_box_get",
    ];
    expect(safe.allowedActions).toEqual([]);
    expect(safe.approvalRequiredActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.allowedActions.map((item) => item.id)).toEqual(reads);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "streak_record_mutation",
        "streak_private_crm",
        "streak_raw_api",
        "streak_bulk_export",
      ]),
    );
  });
});
