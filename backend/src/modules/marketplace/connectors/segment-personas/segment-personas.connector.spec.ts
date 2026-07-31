import { SegmentApiAdapter } from "../segment/segment-api.adapter";
import { SEGMENT_PERSONAS_CONNECTOR_MANIFEST } from "./segment-personas.connector";

describe("Segment Personas connector", () => {
  it("publishes only the bounded audience-readiness tool", () => {
    expect(SEGMENT_PERSONAS_CONNECTOR_MANIFEST.slug).toBe("segment-personas");
    expect(SEGMENT_PERSONAS_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "segmentPersonas.getAudienceReadinessSummary",
    ]);
  });

  it("returns aggregate readiness counts without audience identity", async () => {
    const request = jest.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            audiences: [
              {
                id: "secret-audience-id",
                name: "High value customers",
                enabled: true,
                status: "LIVE",
                audienceType: "USERS",
                computeCadence: { type: "REALTIME" },
              },
            ],
            pagination: { totalEntries: 1, next: null },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const adapter = new SegmentApiAdapter(request);

    const result = await adapter.getAudienceReadinessSummary({
      apiOrigin: "https://api.segmentapis.com",
      publicApiToken: "dedicated-public-api-token",
      workspaceId: "space_123",
    });

    expect(result).toMatchObject({
      returnedCount: 1,
      totalEntries: 1,
      enabledCount: 1,
      liveCount: 1,
      userAudienceCount: 1,
      realtimeCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain("secret-audience-id");
    expect(JSON.stringify(result)).not.toContain("High value customers");
    expect(request).toHaveBeenCalledWith(
      "https://api.segmentapis.com/spaces/space_123/audiences?pagination.count=25",
      expect.objectContaining({ method: "GET", redirect: "error" }),
    );
  });
});
