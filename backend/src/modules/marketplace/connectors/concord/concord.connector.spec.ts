import { ConcordApiAdapter, ConcordApiError } from "./concord-api.adapter";
import { CONCORD_CONNECTOR_MANIFEST } from "./concord.connector";

const credentials = {
  apiKey: "customer-concord-key",
  apiOrigin: "https://uat.concordnow.com",
  organizationId: "42",
};

describe("Concord connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("binds a broad customer key to one environment and organization", () => {
    expect(
      CONCORD_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual([
      "CONCORD_API_ORIGIN",
      "CONCORD_ORGANIZATION_ID",
      "CONCORD_API_KEY",
    ]);
    expect(CONCORD_CONNECTOR_MANIFEST.tools.map((tool) => tool.action)).toEqual(
      ["read", "write"],
    );
    expect(
      CONCORD_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["concord_agreement_draft_create"]);
  });

  it("validates the exact current organization without returning user data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 7,
            email: "private@example.com",
            fullName: "Private User",
            currentOrganizationId: 42,
          }),
          { status: 200 },
        ),
      );
    const result = await new ConcordApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://uat.concordnow.com/api/rest/1/user/me",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "X-API-KEY": "customer-concord-key",
    });
    expect(result).toMatchObject({
      credentialValid: true,
      environment: "sandbox",
      organizationId: "42",
      broadOrganizationKey: true,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("returns only redacted agreement lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "NDA",
            description: "private terms",
            status: "DRAFT",
            read: true,
            inboxed: true,
            bookmarked: false,
            trashed: false,
            lastAccessAt: 1459499655224,
            tags: [{ id: 1, name: "legal" }],
            signedNegotiation: { originator: { name: "Private Org" } },
            source: { fromTemplate: true },
          }),
          { status: 200 },
        ),
      );
    const result = await new ConcordApiAdapter().getAgreementMetadata(
      credentials,
      { agreementUid: "G4VIX7" },
    );
    expect(result.agreement).toEqual({
      agreementUid: "G4VIX7",
      title: "NDA",
      status: "DRAFT",
      read: true,
      inboxed: true,
      bookmarked: false,
      trashed: false,
      lastAccessAt: 1459499655224,
      tags: ["legal"],
      fromTemplate: true,
    });
    expect(JSON.stringify(result)).not.toContain("private terms");
    expect(JSON.stringify(result)).not.toContain("Private Org");
  });

  it("creates only a bounded unsent DRAFT agreement", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "123",
            uid: "01sp9L4YEZNcLHaSV8447N",
            private: "hidden",
          }),
          { status: 201 },
        ),
      );
    const result = await new ConcordApiAdapter().createAgreementDraft(
      credentials,
      { title: "NDA", description: "Review only", tags: ["legal"] },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://uat.concordnow.com/api/rest/1/organizations/42/agreements",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      status: "DRAFT",
      parametersSource: "NONE",
      title: "NDA",
      description: "Review only",
      tags: ["legal"],
    });
    expect(result).toMatchObject({
      agreement: { agreementUid: "01sp9L4YEZNcLHaSV8447N", status: "DRAFT" },
      sent: false,
      shared: false,
      signingStarted: false,
    });
    expect(JSON.stringify(result)).not.toContain("hidden");
  });

  it("rejects invalid bindings and IDs before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new ConcordApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://evil.example" }),
    ).rejects.toBeInstanceOf(ConcordApiError);
    await expect(
      adapter.health({ ...credentials, organizationId: "0" }),
    ).rejects.toBeInstanceOf(ConcordApiError);
    await expect(
      adapter.getAgreementMetadata(credentials, { agreementUid: "../private" }),
    ).rejects.toBeInstanceOf(ConcordApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
