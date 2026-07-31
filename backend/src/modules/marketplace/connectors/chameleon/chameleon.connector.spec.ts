import {
  ChameleonApiAdapter,
  ChameleonApiError,
} from "./chameleon-api.adapter";
import { CHAMELEON_CONNECTOR_MANIFEST } from "./chameleon.connector";

const credentials = { accountSecret: "account-secret" };

describe("Chameleon connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated Tour inventory read", () => {
    expect(
      CHAMELEON_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      CHAMELEON_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["chameleon_tours_list"]);
  });

  it("checks credentials without returning Tour data", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ tours: [{ id: "private-tour" }] }), {
        status: 200,
      }),
    );
    const result = await new ChameleonApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactAccountBound: true,
      tourDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-tour");
  });

  it("lists only bounded projected Tour metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tours: [
            {
              id: "tour-1",
              name: "Onboarding",
              style: "auto",
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-02T00:00:00Z",
              published_at: "2026-01-02T00:00:00Z",
              segment_ids: ["private-segment"],
              dashboard_url: "private-url",
              content_summary: "private-content",
              stats: { started_count: 42 },
            },
          ],
          cursor: { before: "private-cursor" },
        }),
        { status: 200 },
      ),
    );
    const result = await new ChameleonApiAdapter().listTours(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.chameleon.io/v3/edit/tours?limit=1",
    );
    expect(result.tours).toEqual([
      {
        tourId: "tour-1",
        name: "Onboarding",
        style: "auto",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        publishedAt: "2026-01-02T00:00:00Z",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-segment|private-url|private-content|private-cursor/,
    );
  });

  it("rejects missing secrets and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new ChameleonApiAdapter();
    await expect(adapter.health({ accountSecret: "" })).rejects.toBeInstanceOf(
      ChameleonApiError,
    );
    await expect(
      adapter.listTours(credentials, { limit: 51 }),
    ).rejects.toBeInstanceOf(ChameleonApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new ChameleonApiAdapter().listTours(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
