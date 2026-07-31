import { SanityApiAdapter, SanityApiError } from "./sanity-api.adapter";
import { SANITY_CONNECTOR_MANIFEST } from "./sanity.connector";

describe("Sanity connector", () => {
  const credentials = { projectId: "abc123", dataset: "production", apiToken: "sanity-token" };
  afterEach(() => jest.restoreAllMocks());

  it("defines seven exact robot-token tools and Safe versus Dangerous authority", () => {
    expect(SANITY_CONNECTOR_MANIFEST.tools).toHaveLength(7);
    expect(SANITY_CONNECTOR_MANIFEST.auth).toMatchObject({ type: "api_key" });
    expect(SANITY_CONNECTOR_MANIFEST.auth.credentialSchema.map((field) => field.name)).toEqual(["SANITY_PROJECT_ID", "SANITY_DATASET", "SANITY_API_TOKEN"]);
    expect(SANITY_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map((action) => action.id)).toEqual([
      "sanity_document_create_draft", "sanity_document_update_draft", "sanity_document_publish",
    ]);
    expect(SANITY_CONNECTOR_MANIFEST.approvalProfiles[1].approvalRequiredActions).toEqual([]);
  });

  it("pins queries to the configured project and dataset with bounded parameters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: [{ _id: "post-1", _type: "post" }] }), { status: 200 }));
    const result = await new SanityApiAdapter().listDocuments(credentials, { type: "post", limit: 10 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.origin).toBe("https://abc123.api.sanity.io");
    expect(url.pathname).toBe("/v2025-02-19/data/query/production");
    expect(url.searchParams.get("$type")).toBe('"post"');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer sanity-token");
    expect(result).toEqual([{ _id: "post-1", _type: "post" }]);
  });

  it("uses draft-first actions, exact revision checks, and transaction IDs", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({ transactionId: "txn" }), { status: 200 }));
    const adapter = new SanityApiAdapter();
    await adapter.createDraft(credentials, { documentId: "post-1", type: "post", fields: { title: "Draft" }, idempotencyKey: "create-1" });
    await adapter.updateDraft(credentials, { documentId: "post-1", expectedRevisionId: "rev-1", fields: { title: "Updated" }, idempotencyKey: "update-1" });
    await adapter.publishDocument(credentials, { documentId: "post-1", expectedRevisionId: "rev-2", idempotencyKey: "publish-1" });
    const create = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const update = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    const publish = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(create).toMatchObject({ transactionId: "create-1", actions: [{ actionType: "sanity.action.document.create", publishedId: "post-1", document: { _id: "drafts.post-1", _type: "post", title: "Draft" } }] });
    expect(update).toMatchObject({ transactionId: "update-1", mutations: [{ patch: { id: "drafts.post-1", ifRevisionID: "rev-1", set: { title: "Updated" } } }] });
    expect(publish).toMatchObject({ transactionId: "publish-1", actions: [{ actionType: "sanity.action.document.publish", publishedId: "post-1", draftId: "drafts.post-1", ifDraftRevisionId: "rev-2" }] });
  });

  it("redacts secret-shaped response fields and rejects prefixes, reserved fields, secret fields, and unbounded pages", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: [{ _id: "post-1", token: "leak", nested: { apiKey: "leak" } }] }), { status: 200 }));
    const adapter = new SanityApiAdapter();
    await expect(Promise.resolve().then(() => adapter.listDocuments(credentials, { limit: 1000 }))).rejects.toMatchObject<Partial<SanityApiError>>({ code: "provider_validation_error" });
    await expect(Promise.resolve().then(() => adapter.getDocument(credentials, { documentId: "drafts.post-1" }))).rejects.toMatchObject<Partial<SanityApiError>>({ code: "provider_validation_error" });
    await expect(Promise.resolve().then(() => adapter.createDraft(credentials, { documentId: "post-1", type: "post", fields: { _id: "escape" }, idempotencyKey: "create-1" }))).rejects.toMatchObject<Partial<SanityApiError>>({ code: "policy_blocked" });
    await expect(Promise.resolve().then(() => adapter.createDraft(credentials, { documentId: "post-1", type: "post", fields: { apiToken: "escape" }, idempotencyKey: "create-1" }))).rejects.toMatchObject<Partial<SanityApiError>>({ code: "policy_blocked" });
    const result = await adapter.listDocuments(credentials, {});
    expect(result).toEqual([{ _id: "post-1", token: "[redacted]", nested: { apiKey: "[redacted]" } }]);
    expect(JSON.stringify(result)).not.toContain("leak");
  });
});
