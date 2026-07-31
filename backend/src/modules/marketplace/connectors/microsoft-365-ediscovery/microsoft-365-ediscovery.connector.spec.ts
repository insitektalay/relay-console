import { Microsoft365EdiscoveryGraphAdapter } from "./microsoft-365-ediscovery-graph.adapter";
import { MARKETPLACE_CATALOG } from "../../catalog/marketplace-catalog";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const caseId = "58399dff-cebe-478f-b1af-d3227f1fd645";

describe("Microsoft 365 eDiscovery connector", () => {
  const manifest = MARKETPLACE_CATALOG.find(
    ({ slug }) => slug === "microsoft-365-ediscovery",
  )!;

  it("uses exact delegated read scope and approval-gates every legal metadata read", () => {
    expect(manifest.sourceMetadata?.authentication).toMatchObject({
      scopes: [
        "openid",
        "profile",
        "offline_access",
        "https://graph.microsoft.com/eDiscovery.Read.All",
      ],
    });
    expect(manifest.approvalRequiredActions.map(({ id }) => id)).toEqual([
      "microsoft_365_ediscovery_cases_list",
      "microsoft_365_ediscovery_case_get",
      "microsoft_365_ediscovery_searches_list",
      "microsoft_365_ediscovery_review_sets_list",
    ]);
  });

  it("lists bounded case metadata and excludes descriptions and identities", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        value: [
          {
            id: caseId,
            displayName: "Sensitive matter",
            description: "legal strategy",
            externalId: "secret-ref",
            createdBy: { user: { userPrincipalName: "lawyer@example.com" } },
            status: "active",
            createdDateTime: "2026-07-01T00:00:00Z",
          },
        ],
        "@odata.nextLink": "secret-next-page",
      }),
    );
    const result = await new Microsoft365EdiscoveryGraphAdapter(
      requester,
    ).listCases("access-token");
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://graph.microsoft.com/v1.0/security/cases/ediscoveryCases",
    );
    expect(result.cases[0]).toEqual({
      id: caseId,
      displayName: "Sensitive matter",
      status: "active",
      createdDateTime: "2026-07-01T00:00:00Z",
      lastModifiedDateTime: null,
      closedDateTime: null,
    });
    expect(result.truncated).toBe(true);
    expect(result.nextPageFollowed).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(
      /legal strategy|secret-ref|lawyer@example|secret-next-page/,
    );
  });

  it("redacts search queries and review-set document relationships", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          value: [
            {
              id: caseId,
              displayName: "Teams search",
              contentQuery: "subject:acquisition",
              dataSourceScopes: "allTenantMailboxes",
              createdBy: { user: { displayName: "Counsel" } },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        json({
          value: [
            {
              id: caseId,
              displayName: "Review A",
              description: "privileged",
              documents: [{ id: "document-secret" }],
            },
          ],
        }),
      );
    const adapter = new Microsoft365EdiscoveryGraphAdapter(requester);
    const searches = await adapter.listSearches("access-token", { caseId });
    const reviewSets = await adapter.listReviewSets("access-token", { caseId });
    expect(JSON.stringify({ searches, reviewSets })).not.toMatch(
      /subject:|allTenant|Counsel|privileged|document-secret/,
    );
  });

  it("rejects paths derived from invalid case identifiers before network access", async () => {
    const requester = jest.fn();
    await expect(
      new Microsoft365EdiscoveryGraphAdapter(requester).getCase(
        "access-token",
        { caseId: "../users" },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(requester).not.toHaveBeenCalled();
  });

  it("preserves provider throttling without returning provider bodies", async () => {
    await expect(
      new Microsoft365EdiscoveryGraphAdapter(
        jest
          .fn()
          .mockResolvedValue(json({ error: { message: "sensitive" } }, 429)),
      ).listCases("access-token"),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
  });
});
