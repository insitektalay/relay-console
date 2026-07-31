import {
  AgorapulseApiAdapter,
  AgorapulseApiError,
} from "./agorapulse-api.adapter";
import { AGORAPULSE_CONNECTOR_MANIFEST } from "./agorapulse.connector";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Agorapulse connector", () => {
  const credentials = {
    apiKey: "secret-api-key",
    organizationId: "org_42",
    workspaceId: "workspace_7",
  };

  it("exposes only four approval-gated bounded reads", () => {
    expect(AGORAPULSE_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      AGORAPULSE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "agorapulse.listProfiles",
      "agorapulse.getAudienceReport",
      "agorapulse.getCommunityReport",
      "agorapulse.getContentReport",
    ]);
    expect(
      AGORAPULSE_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("validates the exact organization and workspace with bearer auth", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        json({ data: [{ id: "org_42", name: "Private" }] }),
      )
      .mockResolvedValueOnce(
        json({ data: [{ id: "workspace_7", name: "Secret" }] }),
      );
    const adapter = new AgorapulseApiAdapter(requester);
    await expect(adapter.health(credentials)).resolves.toEqual({
      apiOrigin: "https://api.agorapulse.com",
      organizationId: "org_42",
      workspaceId: "workspace_7",
    });
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.agorapulse.com/v1.0/core/organizations",
    );
    expect(requester.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer secret-api-key",
    );
  });

  it("lists at most twenty-five profiles without identity fields", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        data: [
          {
            uid: "profile_1",
            network: "instagram",
            active: true,
            name: "Private profile",
            username: "private_handle",
            avatarUrl: "https://example.test/private.png",
          },
        ],
      }),
    );
    const result = await new AgorapulseApiAdapter(requester).listProfiles(
      credentials,
    );
    expect(result.profiles).toEqual([
      { profileUid: "profile_1", network: "instagram", active: true },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /Private|private_handle|example/,
    );
  });

  it("uses one fixed report path and removes post content and identity", async () => {
    const requester = jest.fn().mockResolvedValue(
      json({
        data: [
          {
            postId: "private-post",
            text: "secret caption",
            username: "private-user",
            impressionsCount: 120,
            engagementRate: 4.5,
            organic: true,
          },
        ],
      }),
    );
    const result = await new AgorapulseApiAdapter(requester).report(
      credentials,
      "content",
      {
        profileUid: "profile_1",
        since: "2026-07-01T00:00:00Z",
        until: "2026-07-15T00:00:00Z",
      },
    );
    expect(String(requester.mock.calls[0][0])).toBe(
      "https://api.agorapulse.com/v1.0/report/organizations/org_42/workspaces/workspace_7/profiles/profile_1/insights/content?since=2026-07-01T00%3A00%3A00.000Z&until=2026-07-15T00%3A00%3A00.000Z",
    );
    expect(result.metrics).toEqual({
      data: [{ impressionsCount: 120, engagementRate: 4.5, organic: true }],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private-post|secret caption|private-user/,
    );
  });

  it("rejects windows over thirty-one days and cross-workspace access", async () => {
    const adapter = new AgorapulseApiAdapter(jest.fn());
    await expect(
      adapter.report(credentials, "audience", {
        profileUid: "profile_1",
        since: "2026-01-01T00:00:00Z",
        until: "2026-03-01T00:00:00Z",
      }),
    ).rejects.toBeInstanceOf(AgorapulseApiError);
    const crossWorkspace = new AgorapulseApiAdapter(
      jest
        .fn()
        .mockResolvedValueOnce(json({ data: [{ id: "org_42" }] }))
        .mockResolvedValueOnce(json({ data: [{ id: "other" }] })),
    );
    await expect(crossWorkspace.health(credentials)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
  });
});
