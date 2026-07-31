import {
  BetterProposalsApiAdapter,
  BetterProposalsApiError,
} from "./better-proposals-api.adapter";
import { BETTER_PROPOSALS_CONNECTOR_MANIFEST } from "./better-proposals.connector";

const credentials = { apiToken: "customer-better-proposals-token" };

describe("Better Proposals connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("confines the broad customer token to fixed privacy-redacted reads", () => {
    expect(BETTER_PROPOSALS_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      BETTER_PROPOSALS_CONNECTOR_MANIFEST.auth.credentialSchema.map(
        (field) => field.name,
      ),
    ).toEqual(["BETTER_PROPOSALS_API_TOKEN"]);
    expect(
      BETTER_PROPOSALS_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read", "read"]);
    expect(
      BETTER_PROPOSALS_CONNECTOR_MANIFEST.approvalProfiles[0]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("validates the token with one fixed proposal-count request", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "success", data: { count: 12 } }), {
        status: 200,
      }),
    );
    const result = await new BetterProposalsApiAdapter().health(credentials);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.betterproposals.io/proposal/count",
    );
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Bptoken: "customer-better-proposals-token",
    });
    expect(result).toMatchObject({
      credentialValid: true,
      proposalCount: 12,
      providerRequestCount: 1,
      broadAccountToken: true,
      writesEnabled: false,
    });
  });

  it("lists at most 50 summaries without private proposal data", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            proposals: Array.from({ length: 60 }, (_, index) => ({
              ID: `proposal-${index}`,
              Name: `Proposal ${index}`,
              Status: "sent",
              Company: { Name: "Private Company" },
              Contacts: [{ Email: "private@example.com" }],
              Pricing: { Total: 1000 },
              URL: "https://private.example/proposal",
              Content: "private body",
            })),
          },
        }),
        { status: 200 },
      ),
    );
    const result = await new BetterProposalsApiAdapter().listProposals(
      credentials,
      { resultLimit: 50 },
    );
    expect(result.proposals).toHaveLength(50);
    expect(result.proposals[0]).toMatchObject({
      proposalId: "proposal-0",
      name: "Proposal 0",
      status: "sent",
    });
    expect(JSON.stringify(result)).not.toContain("Private Company");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(JSON.stringify(result)).not.toContain("private body");
  });

  it("gets one explicit proposal and strips contacts, pricing, signatures, payments, links, and content", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          data: {
            ID: "proposal_123",
            Name: "Renewal",
            Status: "opened",
            DocumentType: "Proposal",
            Currency: "GBP",
            Created: "2026-07-17T10:00:00Z",
            Contacts: [{ Email: "buyer@example.com" }],
            Pricing: { Total: 1000 },
            Signatures: [{ Name: "Buyer" }],
            Payment: { Reference: "private-payment" },
            URL: "https://private.example/proposal",
            Content: "private body",
          },
        }),
        { status: 200 },
      ),
    );
    const result = await new BetterProposalsApiAdapter().getProposal(
      credentials,
      { proposalId: "proposal_123" },
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.betterproposals.io/proposal/proposal_123",
    );
    expect(result.proposal).toEqual({
      proposalId: "proposal_123",
      name: "Renewal",
      status: "opened",
      documentType: "Proposal",
      currency: "GBP",
      createdAt: "2026-07-17T10:00:00Z",
      updatedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("buyer@example.com");
    expect(JSON.stringify(result)).not.toContain("private-payment");
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(JSON.stringify(result)).not.toContain("private body");
  });

  it("rejects invalid tokens, IDs, limits, and provider error envelopes", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new BetterProposalsApiAdapter();
    await expect(adapter.health({ apiToken: "" })).rejects.toBeInstanceOf(
      BetterProposalsApiError,
    );
    await expect(
      adapter.getProposal(credentials, { proposalId: "../private" }),
    ).rejects.toBeInstanceOf(BetterProposalsApiError);
    await expect(
      adapter.listProposals(credentials, { resultLimit: 51 }),
    ).rejects.toBeInstanceOf(BetterProposalsApiError);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ status: "error", message: "Invalid token" }),
        { status: 200 },
      ),
    );
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "credential_missing",
    });
  });
});
