import { TettraApiAdapter, TettraApiError } from "./tettra-api.adapter";
describe("TettraApiAdapter", () => {
  const api = new TettraApiAdapter(); const c = { teamId: "123", apiKey: "fixture" };
  it("fails closed for missing credentials", async () => { await expect(api.search({ teamId: "", apiKey: "" })).rejects.toEqual(expect.any(TettraApiError)); });
  it("validates numeric tenant and resource IDs before network traffic", async () => { await expect(api.getCategoryItems(c, { categoryId: "../admin" })).rejects.toMatchObject({ code: "provider_validation_error" }); });
  it("requires an actual page update", async () => { await expect(api.updatePage(c, { pageId: "9" })).rejects.toMatchObject({ code: "provider_validation_error" }); });
  it("enforces category-name and suggestion shapes", async () => { await expect(api.createCategory(c, { name: "<admin>" })).rejects.toMatchObject({ code: "provider_validation_error" }); await expect(api.createSuggestion(c, {})).rejects.toMatchObject({ code: "provider_validation_error" }); });
});
