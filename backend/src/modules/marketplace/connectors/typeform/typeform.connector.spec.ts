import { MarketplaceConnectorRegistry } from "../connector-registry";
import { TypeformApiAdapter, TypeformApiError } from "./typeform-api.adapter";
import { TYPEFORM_CONNECTOR_MANIFEST } from "./typeform.connector";

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const credentials = {
  accessToken: "access",
  accountId: "account_123",
  workspaceId: "workspace_456",
  apiOrigin: "https://api.typeform.com",
};

describe("Typeform Marketplace connector", () => {
  it("registers exact offline read scopes and single-use refresh support", () => {
    const registry = new MarketplaceConnectorRegistry();
    expect(registry.get("typeform")).toBe(TYPEFORM_CONNECTOR_MANIFEST);
    expect(TYPEFORM_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://api.typeform.com/oauth/authorize",
      tokenUrl: "https://api.typeform.com/oauth/token",
      requiredScopes: [
        "accounts:read",
        "workspaces:read",
        "forms:read",
        "responses:read",
        "offline",
      ],
      pkce: false,
      supportsRefresh: true,
    });
  });

  it("exposes only three bounded approval-gated reads", () => {
    expect(TYPEFORM_CONNECTOR_MANIFEST.tools).toHaveLength(3);
    expect(
      TYPEFORM_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("pins form listing to the selected workspace and fixed first page", async () => {
    const requests: string[] = [];
    const adapter = new TypeformApiAdapter(async (url) => {
      requests.push(String(url));
      return response({ items: [] });
    });
    await adapter.listWorkspaceForms(credentials);
    expect(requests[0]).toBe(
      "https://api.typeform.com/forms?workspace_id=workspace_456&page=1&page_size=25&sort_by=last_updated_at&order_by=desc",
    );
  });

  it("pins response reads to fourteen days, completed only and no cursor", async () => {
    const requests: string[] = [];
    const adapter = new TypeformApiAdapter(
      async (url) => {
        requests.push(String(url));
        return response({ items: [] });
      },
      () => new Date("2026-07-17T09:00:00.000Z"),
    );
    await adapter.listRecentResponses(
      credentials,
      { formId: "abcDEF123" },
      new Date("2026-07-17T09:00:00.000Z"),
    );
    expect(requests[0]).toContain("since=2026-07-03T09%3A00%3A00.000Z");
    expect(requests[0]).toContain("until=2026-07-17T09%3A00%3A00.000Z");
    expect(requests[0]).toContain("page_size=25");
    expect(requests[0]).toContain("response_type=completed");
    expect(requests[0]).toContain("sort=submitted_at%2Cdesc");
    expect(requests[0]).not.toContain("after=");
  });

  it("returns lifecycle metadata while redacting answers and respondent content", async () => {
    const adapter = new TypeformApiAdapter(async () =>
      response({
        items: [
          {
            response_id: "response_789",
            response_type: "completed",
            landed_at: "2026-07-17T08:59:00Z",
            submitted_at: "2026-07-17T09:00:00Z",
            answers: [{ text: "private answer" }],
            hidden: { email: "private@example.com" },
            calculated: { score: 10 },
            metadata: { user_agent: "private-browser" },
            token: "private-token",
            landing_id: "private-landing",
            variables: [{ key: "private", number: 1 }],
          },
        ],
      }),
    );
    const result = await adapter.listRecentResponses(credentials, {
      formId: "abcDEF123",
    });
    expect(result.responses[0]).toMatchObject({
      responseId: "response_789",
      responseType: "completed",
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      "private answer",
      "private@example.com",
      "private-browser",
      "private-token",
      "private-landing",
      "variables",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("rejects unsafe regions and enforces two requests per second per account", async () => {
    const adapter = new TypeformApiAdapter(async () => response({ items: [] }));
    await expect(
      adapter.listWorkspaceForms({
        ...credentials,
        apiOrigin: "https://evil.example",
      }),
    ).rejects.toMatchObject<Partial<TypeformApiError>>({
      code: "credential_missing",
    });
    await adapter.listWorkspaceForms(credentials);
    await expect(
      adapter.getFormSummary(credentials, { formId: "abcDEF123" }),
    ).rejects.toMatchObject<Partial<TypeformApiError>>({
      code: "provider_rate_limited",
    });
  });
});
