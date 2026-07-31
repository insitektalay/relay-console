import { UserflowApiAdapter, UserflowApiError } from "./userflow-api.adapter";
import { USERFLOW_CONNECTOR_MANIFEST } from "./userflow.connector";

const credentials = { apiKey: "environment-key", region: "us" };

describe("Userflow connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("publishes one approval-gated content inventory read", () => {
    expect(
      USERFLOW_CONNECTOR_MANIFEST.tools.map((tool) => tool.action),
    ).toEqual(["read"]);
    expect(
      USERFLOW_CONNECTOR_MANIFEST.approvalProfiles[0].approvalRequiredActions.map(
        (entry) => entry.id,
      ),
    ).toEqual(["userflow_content_list"]);
  });

  it("checks credentials without returning content data", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ id: "private-content" }],
            has_more: false,
          }),
          { status: 200 },
        ),
      );
    const result = await new UserflowApiAdapter().health(credentials);
    expect(result).toMatchObject({
      credentialsVerified: true,
      exactEnvironmentBound: true,
      contentDataReturned: false,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-content");
  });

  it("lists only bounded projected content metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "content-1",
              name: "Onboarding",
              type: "flow",
              created_at: "2026-01-01T00:00:00Z",
              draft_version_id: "draft-1",
              published_version_id: "published-1",
              labels: ["private-label"],
              draft_version: { questions: ["private-question"] },
            },
          ],
          has_more: true,
          next_page_url: "/content?starting_after=private-cursor",
        }),
        { status: 200 },
      ),
    );
    const result = await new UserflowApiAdapter().listContent(credentials, {
      limit: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.userflow.com/content?limit=1&order_by=name",
    );
    expect(result.content).toEqual([
      {
        contentId: "content-1",
        name: "Onboarding",
        type: "flow",
        createdAt: "2026-01-01T00:00:00Z",
        draftVersionId: "draft-1",
        publishedVersionId: "published-1",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /private-label|private-question|private-cursor/,
    );
  });

  it("rejects missing keys, invalid regions, and excessive limits before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    const adapter = new UserflowApiAdapter();
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toBeInstanceOf(UserflowApiError);
    await expect(
      adapter.health({ ...credentials, region: "ap" }),
    ).rejects.toBeInstanceOf(UserflowApiError);
    await expect(
      adapter.listContent(credentials, { limit: 51 }),
    ).rejects.toBeInstanceOf(UserflowApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps rate limits without retrying", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(
      new UserflowApiAdapter().listContent(credentials, {}),
    ).rejects.toMatchObject({ code: "provider_rate_limited", statusCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
