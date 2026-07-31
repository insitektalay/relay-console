import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  DropboxSignApiAdapter,
  DropboxSignApiError,
} from "./dropbox-sign-api.adapter";
import { DROPBOX_SIGN_CONNECTOR_MANIFEST } from "./dropbox-sign.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const credentials = {
  accessToken: "access",
  accountId: "d10338cad145e1cb68afc828",
};

describe("Dropbox Sign Marketplace connector", () => {
  it("registers exact OAuth scopes without inventing PKCE", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("dropbox-sign")).toBe(DROPBOX_SIGN_CONNECTOR_MANIFEST);
    expect(DROPBOX_SIGN_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://app.hellosign.com/oauth/authorize",
      tokenUrl: "https://app.hellosign.com/oauth/token",
      userInfoUrl: "https://api.hellosign.com/v3/account",
      requiredScopes: ["account_access", "signature_request_access"],
      pkce: false,
      supportsRefresh: true,
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(DROPBOX_SIGN_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      DROPBOX_SIGN_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins list requests to page one, size twenty-five and fixed awaiting query", async () => {
    const requests: string[] = [];
    const adapter = new DropboxSignApiAdapter(async (url) => {
      requests.push(String(url));
      return response({ signature_requests: [] });
    });
    await adapter.listSignatureRequests(credentials);
    await adapter.listAwaitingSignatureRequests(credentials);
    expect(requests[0]).toBe(
      "https://api.hellosign.com/v3/signature_request/list?page=1&page_size=25",
    );
    expect(requests[1]).toContain("page=1&page_size=25");
    expect(requests[1]).toContain("query=awaiting_my_signature%3Atrue");
  });

  it("aggregates safe statuses while redacting participant and document content", async () => {
    const adapter = new DropboxSignApiAdapter(async () =>
      response({
        signature_request: {
          signature_request_id: "d10338cad145e1cb68afc828",
          title: "Agreement",
          subject: "Please review",
          created_at: 1_783_763_200,
          is_complete: false,
          signatures: [
            {
              status_code: "awaiting_signature",
              signer_email_address: "private@example.com",
              signature_id: "private-id",
              signing_url: "https://private.example/sign",
            },
          ],
          requester_email_address: "requester@example.com",
          files_url: "https://private.example/files",
          metadata: { customer: "secret" },
          response_data: [{ value: "private answer" }],
        },
      }),
    );
    const result = await adapter.getSignatureRequest(credentials, {
      signatureRequestId: "d10338cad145e1cb68afc828",
    });
    expect(result.signatureRequest).toMatchObject({
      signatureRequestId: "d10338cad145e1cb68afc828",
      signatureCount: 1,
      signatureStatusCounts: { awaiting_signature: 1 },
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "private@example.com",
      "requester@example.com",
      "private-id",
      "private answer",
      "files_url",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("validates the exact token account and rejects unsafe request IDs", async () => {
    const adapter = new DropboxSignApiAdapter(async () =>
      response({ account: { account_id: "d10338cad145e1cb68afc828" } }),
    );
    await expect(adapter.health(credentials)).resolves.toMatchObject({
      accountId: "d10338cad145e1cb68afc828",
    });
    await expect(
      adapter.getSignatureRequest(credentials, {
        signatureRequestId: "../account",
      }),
    ).rejects.toMatchObject<Partial<DropboxSignApiError>>({
      code: "provider_validation_error",
    });
  });
});
