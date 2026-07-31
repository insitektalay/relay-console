import {
  GetAcceptApiAdapter,
  GetAcceptApiError,
} from "./getaccept-api.adapter";
import { GETACCEPT_CONNECTOR_MANIFEST } from "./getaccept.connector";

const credentials = { accessToken: "customer-support-provisioned-token" };
const input = {
  name: "Mutual NDA",
  fileUrl: "https://files.example.com/legal/nda.pdf",
  recipients: [
    {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
    },
  ],
  customFields: [{ name: "Deal stage", value: "Review" }],
};

describe("GetAccept connector", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("uses a customer-owned encrypted token and approval-gates draft creation", () => {
    expect(GETACCEPT_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(GETACCEPT_CONNECTOR_MANIFEST.auth.credentialSchema).toEqual([
      expect.objectContaining({
        name: "GETACCEPT_ACCESS_TOKEN",
        secret: true,
        storedIn: "encrypted_secret",
      }),
    ]);
    expect(
      GETACCEPT_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (action) => action.id,
      ),
    ).toEqual(["getaccept_document_create_draft"]);
    expect(
      GETACCEPT_CONNECTOR_MANIFEST.approvalProfiles[1].allowedActions.map(
        (action) => action.id,
      ),
    ).toEqual(["getaccept_document_create_draft"]);
  });

  it("validates token presence without creating a provider resource", () => {
    const adapter = new GetAcceptApiAdapter();
    expect(adapter.health(credentials)).toMatchObject({
      credentialPresent: true,
      validationMode: "presence_only",
      providerRequestCount: 0,
      automaticSendingEnabled: false,
    });
    expect(() => adapter.health({ accessToken: "" })).toThrow(
      GetAcceptApiError,
    );
  });

  it("creates one fixed unsent draft and returns only bounded metadata", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "doc-123",
          name: "Mutual NDA",
          status: "draft",
          created_at: "2026-07-17T16:00:00Z",
          recipients: [{ email: "ada@example.com" }],
          file_url: input.fileUrl,
          token: "provider-secret",
        }),
        { status: 201 },
      ),
    );
    global.fetch = fetchMock as typeof fetch;

    const result = await new GetAcceptApiAdapter().createDocumentDraft(
      credentials,
      input,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.getaccept.com/v1/documents",
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(request.method).toBe("POST");
    expect(JSON.parse(String(request.body))).toEqual({
      name: "Mutual NDA",
      file_url: "https://files.example.com/legal/nda.pdf",
      recipients: [
        {
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
          role: "signer",
        },
      ],
      is_automatic_sending: false,
      custom_fields: [{ name: "Deal stage", value: "Review" }],
    });
    expect(result).toMatchObject({
      document: {
        documentId: "doc-123",
        name: "Mutual NDA",
        status: "draft",
      },
      recipientCount: 1,
      customFieldCount: 1,
      automaticSendingEnabled: false,
      sent: false,
      providerRequestCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain("ada@example.com");
    expect(JSON.stringify(result)).not.toContain(input.fileUrl);
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects private file sources, duplicate recipients, and ambiguous custom fields before fetch", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const adapter = new GetAcceptApiAdapter();
    await expect(
      adapter.createDocumentDraft(credentials, {
        ...input,
        fileUrl: "https://127.0.0.1/private.pdf",
      }),
    ).rejects.toBeInstanceOf(GetAcceptApiError);
    await expect(
      adapter.createDocumentDraft(credentials, {
        ...input,
        recipients: [...input.recipients, ...input.recipients],
      }),
    ).rejects.toBeInstanceOf(GetAcceptApiError);
    await expect(
      adapter.createDocumentDraft(credentials, {
        ...input,
        customFields: [{ id: "field-1", name: "Field", value: "x" }],
      }),
    ).rejects.toBeInstanceOf(GetAcceptApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps provider failures to safe errors without returning provider bodies", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            message: "token customer-support-provisioned-token invalid",
          }),
          { status: 401 },
        ),
      ) as typeof fetch;
    await expect(
      new GetAcceptApiAdapter().createDocumentDraft(credentials, input),
    ).rejects.toMatchObject({
      code: "credential_missing",
      message: "GetAccept rejected the bounded draft request.",
      statusCode: 401,
    });
  });
});
