import { ArchbeeApiAdapter, ArchbeeApiError } from "./archbee-api.adapter";

describe("ArchbeeApiAdapter", () => {
  const adapter = new ArchbeeApiAdapter();
  const credentials = { docSpaceId: "space-123", apiKey: "fixture-key" };
  afterEach(() => jest.restoreAllMocks());

  it("pins safe search to non-persistent word search and sends the documented bearer", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ docs: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    await adapter.searchDocuments(credentials, { query: "relay" });
    const [, init] = fetchMock.mock.calls[0];
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.archbee.com/api/public-api/docs/search");
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: `Bearer ${Buffer.from("space-123~fixture-key").toString("base64")}` }));
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({ query: "relay", type: "words", persistSearch: false }));
  });

  it("rejects alternate, traversal, and credential-bearing requests", async () => {
    await expect(adapter.request(credentials, { method: "POST", path: "/api/public-api/../admin", json: {} })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/api/public-api/space/create", json: { apiKey: "leak" } })).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("fails closed when customer credentials are absent", async () => {
    await expect(adapter.searchDocuments({ docSpaceId: "", apiKey: "" }, { query: "relay" })).rejects.toEqual(expect.any(ArchbeeApiError));
  });

  it("bounds and validates uploaded files before network traffic", async () => {
    await expect(adapter.uploadFile(credentials, { filename: "payload.exe", fileBase64: "YQ==" })).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(adapter.uploadFile(credentials, { filename: "payload.json", fileBase64: "%%%" })).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
