import {
  ContractbookApiAdapter,
  ContractbookApiError,
} from "./contractbook-api.adapter";
import { CONTRACTBOOK_CONNECTOR_MANIFEST } from "./contractbook.connector";

const credentials = { apiKey: "customer-contractbook-key" };

describe("Contractbook connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the customer API key on one fixed read-only surface", () => {
    expect(
      CONTRACTBOOK_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["CONTRACTBOOK_API_KEY"]);
    expect(
      CONTRACTBOOK_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      CONTRACTBOOK_CONNECTOR_MANIFEST.approvalProfiles[0]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates production access without returning document data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            documents: [{ id: "private-id", title: "Private NDA" }],
            pagination_meta: { cursor: "private-cursor" },
          }),
          { status: 200 },
        ),
      );
    const result = await new ContractbookApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.contractbook.com/v3/documents?page_size=1&full=false",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer customer-contractbook-key",
    });
    expect(result).toMatchObject({
      apiKeyVerified: true,
      productionEnvironmentBound: true,
      documentDataReturned: false,
      peopleReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("Private NDA");
  });

  it("lists only bounded document lifecycle metadata", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            documents: [
              {
                id: "497f6eca-6276-4993-bfeb-53cbbbba6f08",
                type: "contract",
                state: "signed",
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-02T00:00:00Z",
                signed_at: "2026-01-02T00:00:00Z",
                title: "Private agreement",
                owner: { email: "owner@example.com" },
                parties: [{ name: "Private counterparty" }],
              },
            ],
            pagination_meta: { cursor: "private-cursor" },
          }),
          { status: 200 },
        ),
      );
    const result = await new ContractbookApiAdapter().listDocumentLifecycles(
      credentials,
      { limit: 1 },
    );
    expect(result.documents).toEqual([
      {
        documentId: "497f6eca-6276-4993-bfeb-53cbbbba6f08",
        type: "contract",
        state: "signed",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        signedAt: "2026-01-02T00:00:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("Private agreement");
    expect(JSON.stringify(result)).not.toContain("owner@example.com");
    expect(JSON.stringify(result)).not.toContain("private-cursor");
  });

  it("rejects missing keys and invalid limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new ContractbookApiAdapter();
    await expect(adapter.health({ apiKey: "" })).rejects.toBeInstanceOf(
      ContractbookApiError,
    );
    await expect(
      adapter.listDocumentLifecycles(credentials, { limit: 26 }),
    ).rejects.toBeInstanceOf(ContractbookApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Rate exceeded" }), {
          status: 429,
        }),
      );
    await expect(
      new ContractbookApiAdapter().listDocumentLifecycles(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
