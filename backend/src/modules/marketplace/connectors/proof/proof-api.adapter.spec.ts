import { ProofApiAdapter, ProofApiError } from "./proof-api.adapter";

describe("ProofApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("returns only bounded transaction status fields", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            transactions: [
              {
                id: "ot_123",
                status: "completed",
                detailed_status: "complete",
                transaction_type: "notarization",
                date_created: "2026-07-01T00:00:00Z",
                date_updated: "2026-07-02T00:00:00Z",
                signers: [{ email: "private@example.com" }],
                documents: [{ final_document_url: "https://secret.example" }],
                transaction_access_link: "https://secret.example/access",
              },
            ],
          }),
          { status: 200 },
        ),
      );
    const result = await new ProofApiAdapter().listTransactions({
      apiKey: "prf_test_placeholder",
    });
    expect(result).toEqual({
      transactions: [
        {
          id: "ot_123",
          status: "completed",
          detailedStatus: "complete",
          transactionType: "notarization",
          createdAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-02T00:00:00Z",
        },
      ],
      count: 1,
      nextPageFollowed: false,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private|document|access_link|secret\.example/i,
    );
  });

  it("rejects arbitrary transaction identifiers before a provider call", async () => {
    await expect(
      new ProofApiAdapter().getTransaction(
        { apiKey: "prf_test_placeholder" },
        "../../other",
      ),
    ).rejects.toMatchObject<Partial<ProofApiError>>({
      code: "provider_validation_error",
    });
  });
});
