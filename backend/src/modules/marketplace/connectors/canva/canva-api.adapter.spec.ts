import { CanvaApiAdapter, CanvaApiError } from "./canva-api.adapter";
import { CANVA_CONNECTOR_MANIFEST, CANVA_SCOPES } from "./canva.connector";

describe("Canva connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses Relay-owned PKCE OAuth and six stable tools", () => {
    expect(CANVA_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      authorizationUrl: "https://www.canva.com/api/oauth/authorize",
      tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
      refreshUrl: "https://api.canva.com/rest/v1/oauth/token",
      revocationUrl: "https://api.canva.com/rest/v1/oauth/revoke",
      requiredScopes: CANVA_SCOPES,
      pkce: true,
      supportsRefresh: true,
    });
    expect(CANVA_CONNECTOR_MANIFEST.tools).toHaveLength(6);
    expect(
      CANVA_CONNECTOR_MANIFEST.tools.filter((tool) => tool.approvalRequired),
    ).toHaveLength(1);
    expect(
      CANVA_CONNECTOR_MANIFEST.approvalProfiles.find(
        (profile) => profile.id === "dangerously_skip_permissions",
      )?.approvalRequiredActions,
    ).toEqual([]);
  });

  it("preserves bounded design metadata without returning temporary URLs", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "design-1",
              title: "Launch",
              owner: { user_id: "user-1", team_id: "team-1" },
              created_at: "2026-01-01T00:00:00Z",
              page_count: 3,
              thumbnail: { width: 400, height: 300, url: "secret-temporary" },
              urls: { edit_url: "secret-edit", view_url: "secret-view" },
            },
          ],
          continuation: "next",
        }),
        { status: 200 },
      ),
    );
    const result = await new CanvaApiAdapter().listDesigns("token", {
      maxResults: 10,
      ownership: "owned",
    });
    expect(fetchMock.mock.calls[0][0].toString()).toContain(
      "/rest/v1/designs?limit=10&ownership=owned",
    );
    expect(JSON.stringify(result)).not.toContain("secret-");
    expect(result).toMatchObject({
      continuation: "next",
      nextPageFollowed: false,
      designs: [
        {
          id: "design-1",
          owner: { userId: "user-1", teamId: "team-1" },
          pageCount: 3,
          thumbnail: { width: 400, height: 300, urlPersisted: false },
          navigation: { available: true, urlPersisted: false },
        },
      ],
    });
  });

  it("creates only a fixed-origin bounded blank design", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ design: { id: "design-2", title: "Plan" } }),
        {
          status: 201,
        },
      ),
    );
    const result = await new CanvaApiAdapter().createDesign("token", {
      designType: "custom",
      width: 1200,
      height: 628,
      title: "Plan",
      idempotencyKey: "idem-1",
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://api.canva.com/rest/v1/designs",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(result).toMatchObject({
      operation: "create",
      idempotencyKey: "idem-1",
      design: { id: "design-2" },
    });
  });

  it("prepares locally and rejects unsafe dimensions", () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const result = new CanvaApiAdapter().prepareDesign({
      designType: "preset",
      presetName: "presentation",
      title: "Review",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      providerMutation: false,
      providerRequestCount: 0,
      design: { designType: "preset", presetName: "presentation" },
    });
    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(() =>
      new CanvaApiAdapter().prepareDesign({
        designType: "custom",
        width: 8000,
        height: 8000,
      }),
    ).toThrow(CanvaApiError);
  });
});
