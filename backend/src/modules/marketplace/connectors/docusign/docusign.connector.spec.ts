import { MarketplaceConnectorRegistry } from "../connector-registry";
import { DocusignApiAdapter, DocusignApiError } from "./docusign-api.adapter";
import { DOCUSIGN_CONNECTOR_MANIFEST } from "./docusign.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const credentials = {
  accessToken: "access",
  accountId: "11111111-2222-3333-4444-555555555555",
  baseUri: "https://na4.docusign.net",
};

describe("Docusign Marketplace connector", () => {
  it("registers exact OAuth scopes, PKCE and extended refresh support", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("docusign")).toBe(DOCUSIGN_CONNECTOR_MANIFEST);
    expect(DOCUSIGN_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://account.docusign.com/oauth/auth",
      tokenUrl: "https://account.docusign.com/oauth/token",
      userInfoUrl: "https://account.docusign.com/oauth/userinfo",
      requiredScopes: ["signature", "extended"],
      pkce: true,
      supportsRefresh: true,
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(DOCUSIGN_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      DOCUSIGN_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
    expect(
      DOCUSIGN_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions,
    ).toHaveLength(3);
  });

  it("pins list requests to the selected account and fixed bounds", async () => {
    const requests: string[] = [];
    const adapter = new DocusignApiAdapter(async (url) => {
      requests.push(String(url));
      return response({ envelopes: [] });
    });
    await adapter.listRecentEnvelopes(
      credentials,
      new Date("2026-07-17T09:00:00.000Z"),
    );
    await adapter.listActionRequiredEnvelopes(
      credentials,
      new Date("2026-07-17T09:00:00.000Z"),
    );
    expect(requests[0]).toContain(
      "/restapi/v2.1/accounts/11111111-2222-3333-4444-555555555555/envelopes",
    );
    expect(requests[0]).toContain("count=25");
    expect(requests[0]).toContain("order_by=last_modified");
    expect(requests[0]).toContain("2026-07-03T09%3A00%3A00.000Z");
    expect(requests[1]).toContain("folder_ids=awaiting_my_signature");
  });

  it("redacts recipients, documents, tabs, payments and audit details", async () => {
    const adapter = new DocusignApiAdapter(async () =>
      response({
        envelopeId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        emailSubject: "Approval",
        status: "sent",
        createdDateTime: "2026-07-17T09:00:00Z",
        recipients: { signers: [{ email: "private@example.com" }] },
        envelopeDocuments: [{ name: "Private.pdf" }],
        customFields: { textCustomFields: [{ value: "secret" }] },
        tabs: { textTabs: [{ value: "private answer" }] },
        paymentDetails: { currencyCode: "GBP" },
        envelopeIdStamping: true,
      }),
    );
    const result = await adapter.getEnvelope(credentials, {
      envelopeId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    expect(result.envelope).toMatchObject({
      envelopeId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      emailSubject: "Approval",
      status: "sent",
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "private@example.com",
      "Private.pdf",
      "private answer",
      "paymentDetails",
      "customFields",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects unsafe account routing and repeated exact-envelope reads", async () => {
    const adapter = new DocusignApiAdapter(async () => response({}));
    await expect(
      adapter.listRecentEnvelopes({
        ...credentials,
        baseUri: "https://evil.example",
      }),
    ).rejects.toMatchObject<Partial<DocusignApiError>>({
      code: "credential_missing",
    });
    await adapter.getEnvelope(credentials, {
      envelopeId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
    await expect(
      adapter.getEnvelope(credentials, {
        envelopeId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    ).rejects.toMatchObject<Partial<DocusignApiError>>({
      code: "provider_rate_limited",
    });
  });
});
