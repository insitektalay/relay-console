import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  DocusignIdentifyApiAdapter,
  DocusignIdentifyApiError,
} from "./docusign-identify-api.adapter";
import { DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST } from "./docusign-identify.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Docusign Identify connector", () => {
  it("publishes one approval-gated account-bound workflow read", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("docusign-identify")).toBe(
      DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST,
    );
    expect(DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST.tools).toHaveLength(1);
    expect(DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST.tools[0]).toMatchObject({
      name: "docusignIdentify.listWorkflows",
      approvalRequired: true,
    });
    expect(
      DOCUSIGN_IDENTIFY_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes,
    ).toEqual(["signature", "extended"]);
  });

  it("binds health to the provider-selected account and regional base URI", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        sub: "user_123",
        name: "Relay Tester",
        accounts: [
          {
            account_id: "1234-abcd",
            account_name: "Example",
            base_uri: "https://na4.docusign.net",
            is_default: true,
          },
        ],
      }),
    );
    const adapter = new DocusignIdentifyApiAdapter(requester);
    await expect(adapter.health({ accessToken: "token" })).resolves.toEqual({
      userId: "user_123",
      userName: "Relay Tester",
      accountId: "1234-abcd",
      accountName: "Example",
      baseUri: "https://na4.docusign.net",
    });
    expect(requester.mock.calls[0][0].toString()).toBe(
      "https://account.docusign.com/oauth/userinfo",
    );
  });

  it("reduces workflow results and excludes evidence or signer data", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        identityVerification: [
          {
            workflowId: "wf-1",
            defaultName: "ID Verification",
            workflowResourceKey: "resource-key",
            type: "IDV",
            isDefault: true,
            signer: { email: "private@example.com" },
            evidence: { document: "secret" },
          },
        ],
      }),
    );
    const adapter = new DocusignIdentifyApiAdapter(requester);
    const result = await adapter.listWorkflows({
      accessToken: "token",
      accountId: "1234-abcd",
      baseUri: "https://na4.docusign.net",
    });
    expect(result).toEqual({
      workflows: [
        {
          workflowId: "wf-1",
          defaultName: "ID Verification",
          workflowResourceKey: "resource-key",
          type: "IDV",
          isDefault: true,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(requester.mock.calls[0][0].toString()).toBe(
      "https://na4.docusign.net/restapi/v2.1/accounts/1234-abcd/identify_verification",
    );
  });

  it("rejects untrusted regional origins before any provider request", async () => {
    const requester = jest.fn();
    const adapter = new DocusignIdentifyApiAdapter(requester);
    await expect(
      adapter.listWorkflows({
        accessToken: "token",
        accountId: "1234-abcd",
        baseUri: "https://evil.example",
      }),
    ).rejects.toBeInstanceOf(DocusignIdentifyApiError);
    expect(requester).not.toHaveBeenCalled();
  });
});
