import { SegmentApiAdapter } from "./segment-api.adapter";

const credentials = {
  apiOrigin: "https://eu1.api.segmentapis.com",
  publicApiToken: "private-segment-public-token",
  workspaceId: "9aQ1Lj62S4bomZKLF4DPqW",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SegmentApiAdapter", () => {
  it("validates the exact regional origin and token-bound Workspace", async () => {
    const request = jest.fn(async () =>
      response({
        data: {
          workspace: {
            id: credentials.workspaceId,
            name: "Private Workspace",
            slug: "private",
          },
        },
      }),
    );
    const result = await new SegmentApiAdapter(request).health(credentials);
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://eu1.api.segmentapis.com/");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer private-segment-public-token",
      Accept: "application/vnd.segment.v1+json",
    });
    expect(result).toEqual({
      apiOrigin: credentials.apiOrigin,
      workspaceId: credentials.workspaceId,
      apiVersion: "v1",
      reachable: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private Workspace");
  });

  it("lists bounded Source metadata without names, write keys, settings, or labels", async () => {
    const request = jest.fn(async () =>
      response({
        data: {
          sources: [
            {
              id: "source1",
              workspaceId: credentials.workspaceId,
              enabled: true,
              name: "Private Source",
              writeKeys: ["private-write-key"],
              settings: { apiHost: "private" },
              labels: [{ key: "private" }],
              metadata: {
                slug: "javascript",
                status: "PUBLIC",
                partnerOwned: false,
                description: "private",
              },
            },
          ],
        },
      }),
    );
    const result = await new SegmentApiAdapter(request).listSources(
      credentials,
    );
    expect((request.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe(
      "https://eu1.api.segmentapis.com/sources?pagination.count=25",
    );
    expect(result.sources[0]).toEqual({
      sourceId: "source1",
      workspaceId: credentials.workspaceId,
      enabled: true,
      sourceType: "javascript",
      sourceStatus: "PUBLIC",
      partnerOwned: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-write-key");
    expect(JSON.stringify(result)).not.toContain("settings");
  });

  it("lists bounded Destination metadata without names, settings, secrets, or actions", async () => {
    const request = jest.fn(async () =>
      response({
        data: {
          destinations: [
            {
              id: "destination1",
              sourceId: "source1",
              enabled: false,
              name: "Private",
              settings: { secretId: "private-secret" },
              metadata: {
                slug: "amazon-kinesis",
                status: "PUBLIC",
                partnerOwned: false,
                actions: ["private"],
              },
            },
          ],
        },
      }),
    );
    const result = await new SegmentApiAdapter(request).listDestinations(
      credentials,
    );
    expect(result.destinations[0]).toEqual({
      destinationId: "destination1",
      sourceId: "source1",
      enabled: false,
      destinationType: "amazon-kinesis",
      destinationStatus: "PUBLIC",
      partnerOwned: false,
    });
    expect(JSON.stringify(result)).not.toContain("private-secret");
    expect(JSON.stringify(result)).not.toContain("actions");
  });

  it("rejects arbitrary origins and mismatched Workspace IDs", async () => {
    const request = jest.fn(async () =>
      response({ data: { workspace: { id: "otherWorkspace" } } }),
    );
    const adapter = new SegmentApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.com" }),
    ).rejects.toMatchObject({ code: "segment_api_origin_invalid" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "segment_workspace_mismatch",
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
