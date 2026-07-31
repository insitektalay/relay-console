import { TEXAU_CONNECTOR_MANIFEST } from "./texau.connector";

describe("TexAu connector manifest", () => {
  it("binds one encrypted API key and one typed classifier", () => {
    expect(TEXAU_CONNECTOR_MANIFEST).toMatchObject({ slug: "texau", auth: { type: "api_key" } });
    expect(TEXAU_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["TEXAU_API_KEY"]);
    expect(TEXAU_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual(["texau.identifyEmailType"]);
  });
  it("keeps enrichment, automation, raw API, and bulk work blocked in Dangerous", () => {
    const dangerous = TEXAU_CONNECTOR_MANIFEST.approvalProfiles[1];
    expect(dangerous.allowedActions).toHaveLength(1);
    expect(dangerous.blockedActions.map((item) => item.id)).toEqual(expect.arrayContaining(["texau_enrichment", "texau_automation", "texau_raw_api", "texau_bulk_async"]));
  });
});
