import {
  StatuspageCloudApiAdapter,
  StatuspageCloudApiError,
} from "./statuspage-cloud-api.adapter";

describe("StatuspageCloudApiAdapter", () => {
  it("binds reads to one page and minimizes component output", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response([
          {
            id: "component1",
            name: "API",
            status: "operational",
            automation_email: "secret@example.com",
          },
        ]),
      );
    const adapter = new StatuspageCloudApiAdapter(fetchMock as typeof fetch);
    const result = await adapter.listComponents({
      apiToken: "test-token",
      pageId: "page123",
    });
    expect(result.components[0]).toEqual(
      expect.objectContaining({
        id: "component1",
        name: "API",
        status: "operational",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("secret@example.com");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.statuspage.io/v1/pages/page123/components?page=1&per_page=25",
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      "OAuth test-token",
    );
  });

  it("sends only one documented component status", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response({ id: "component1", status: "major_outage" }),
      );
    const adapter = new StatuspageCloudApiAdapter(fetchMock as typeof fetch);
    await adapter.updateComponentStatus(
      { apiToken: "test-token", pageId: "page123" },
      { componentId: "component1", status: "major_outage" },
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      component: { status: "major_outage" },
    });
  });

  it("rejects arbitrary page IDs before network access", async () => {
    const fetchMock = jest.fn();
    const adapter = new StatuspageCloudApiAdapter(fetchMock as typeof fetch);
    await expect(
      adapter.health({ apiToken: "test-token", pageId: "../other" }),
    ).rejects.toMatchObject<Partial<StatuspageCloudApiError>>({
      code: "provider_validation_error",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
