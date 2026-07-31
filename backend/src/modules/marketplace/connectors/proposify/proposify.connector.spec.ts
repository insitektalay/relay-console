import {
  ProposifyApiAdapter,
  ProposifyApiError,
} from "./proposify-api.adapter";
import { PROPOSIFY_CONNECTOR_MANIFEST } from "./proposify.connector";

const credentials = { clientId: "relay.customer", clientSecret: "secret" };
const tokenResponse = () =>
  new Response(
    JSON.stringify({
      access_token: "short-lived-token",
      token_type: "Bearer",
      expires_in: 600,
    }),
    { status: 200 },
  );

describe("Proposify connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses customer-owned client credentials with exactly read_documents", () => {
    expect(PROPOSIFY_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      PROPOSIFY_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["PROPOSIFY_CLIENT_ID", "PROPOSIFY_CLIENT_SECRET"]);
    expect(PROPOSIFY_CONNECTOR_MANIFEST.tools).toHaveLength(1);
    expect(PROPOSIFY_CONNECTOR_MANIFEST.tools[0]).toMatchObject({
      action: "read",
      approvalRequired: false,
    });
    expect(PROPOSIFY_CONNECTOR_MANIFEST.healthChecks[0].requiredScopes).toEqual(
      ["read_documents"],
    );
  });

  it("validates the confidential client through exact-scope token exchange", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(tokenResponse());
    const result = await new ProposifyApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://connect.proposify.com/oauth/token",
    );
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      "grant_type=client_credentials&scope=read_documents",
    );
    expect(result).toMatchObject({
      clientCredentialsVerified: true,
      exactScopes: ["read_documents"],
      providerRequestCount: 1,
      writesEnabled: false,
    });
  });

  it("reads one fixed V3 document and strips people, content, clients, and links", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "497f6eca-6276-4993-bfeb-53cbbbba6f08",
            name: "Proposal",
            status: "DRAFT",
            is_locked: true,
            created_at: "2026-07-17T10:00:00Z",
            updated_at: "2026-07-17T11:00:00Z",
            createdBy: { email: "private@example.com" },
            data: { content: "private body" },
            client: { name: "Private Client" },
            links: { publicUrl: "https://private.example/proposal" },
          }),
          { status: 200 },
        ),
      );
    const result = await new ProposifyApiAdapter().getDocument(credentials, {
      documentId: "497f6eca-6276-4993-bfeb-53cbbbba6f08",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://connect.proposify.com/v3/document/497f6eca-6276-4993-bfeb-53cbbbba6f08",
    );
    expect(result.document).toEqual({
      documentId: "497f6eca-6276-4993-bfeb-53cbbbba6f08",
      name: "Proposal",
      status: "DRAFT",
      locked: true,
      createdAt: "2026-07-17T10:00:00Z",
      updatedAt: "2026-07-17T11:00:00Z",
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private body");
    expect(JSON.stringify(result)).not.toContain("Private Client");
    expect(JSON.stringify(result)).not.toContain("private.example");
  });

  it("rejects invalid credentials and document IDs before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new ProposifyApiAdapter();
    await expect(
      adapter.health({ clientId: "bad/id", clientSecret: "secret" }),
    ).rejects.toBeInstanceOf(ProposifyApiError);
    await expect(
      adapter.getDocument(credentials, { documentId: "../private" }),
    ).rejects.toBeInstanceOf(ProposifyApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
