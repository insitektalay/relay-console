import { MarketplaceConnectorRegistry } from "../connector-registry";
import { PandaDocApiAdapter, PandaDocApiError } from "./pandadoc-api.adapter";
import { PANDADOC_CONNECTOR_MANIFEST } from "./pandadoc.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const credentials = {
  accessToken: "access",
  membershipId: "member_123",
  workspaceId: "workspace_456",
};

describe("PandaDoc Marketplace connector", () => {
  it("registers exact read-only OAuth without inventing PKCE", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("pandadoc")).toBe(PANDADOC_CONNECTOR_MANIFEST);
    expect(PANDADOC_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.pandadoc.com/oauth2/authorize",
      tokenUrl: "https://api.pandadoc.com/oauth2/access_token",
      requiredScopes: ["read"],
      pkce: false,
      supportsRefresh: true,
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(PANDADOC_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      PANDADOC_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins recent documents and folders to fixed dates, count, page and order", async () => {
    const requests: string[] = [];
    const adapter = new PandaDocApiAdapter(async (url) => {
      requests.push(String(url));
      return response({ results: [] });
    });
    await adapter.listRecentDocuments(
      credentials,
      new Date("2026-07-17T09:00:00.000Z"),
    );
    await adapter.listDocumentFolders(credentials);
    expect(requests[0]).toContain("created_from=2026-07-03T09%3A00%3A00.000Z");
    expect(requests[0]).toContain("created_to=2026-07-17T09%3A00%3A00.000Z");
    expect(requests[0]).toContain("count=25&page=1&order_by=-date_created");
    expect(requests[1]).toBe(
      "https://api.pandadoc.com/public/v1/documents/folders?count=25&page=1",
    );
  });

  it("uses the lightweight status endpoint and redacts private document state", async () => {
    const requests: string[] = [];
    const adapter = new PandaDocApiAdapter(async (url) => {
      requests.push(String(url));
      return response({
        id: "BhVzRcxH9Z2LgfPPGXFUBa",
        name: "Proposal",
        status: "document.sent",
        date_created: "2026-07-17T09:00:00Z",
        recipients: [{ email: "private@example.com" }],
        fields: [{ value: "private answer" }],
        pricing: { total: 1000 },
        metadata: { customer: "secret" },
        content_placeholders: [{ block_id: "private" }],
      });
    });
    const result = await adapter.getDocumentStatus(credentials, {
      documentId: "BhVzRcxH9Z2LgfPPGXFUBa",
    });
    expect(requests[0]).toBe(
      "https://api.pandadoc.com/public/v1/documents/BhVzRcxH9Z2LgfPPGXFUBa",
    );
    expect(requests[0]).not.toContain("/details");
    expect(result.document).toMatchObject({
      documentId: "BhVzRcxH9Z2LgfPPGXFUBa",
      status: "document.sent",
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "private@example.com",
      "private answer",
      "pricing",
      "metadata",
      "content_placeholders",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects unsafe identifiers and changed membership/workspace bindings", async () => {
    const adapter = new PandaDocApiAdapter(async () =>
      response({ results: [] }),
    );
    await expect(
      adapter.getDocumentStatus(credentials, { documentId: "../details" }),
    ).rejects.toMatchObject<Partial<PandaDocApiError>>({
      code: "provider_validation_error",
    });
    await expect(adapter.health(credentials)).rejects.toMatchObject<
      Partial<PandaDocApiError>
    >({ code: "insufficient_scope" });
  });
});
