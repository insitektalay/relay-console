import {
  OpsgenieCloudApiAdapter,
  OpsgenieCloudApiError,
} from "./opsgenie-cloud-api.adapter";

describe("OpsgenieCloudApiAdapter", () => {
  it("uses the fixed EU origin and returns only bounded alert summaries", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response({
          data: [
            {
              id: "alert-1",
              message: "Database unavailable",
              status: "open",
              acknowledged: false,
              details: { token: "hidden" },
            },
          ],
        }),
      );
    const adapter = new OpsgenieCloudApiAdapter(fetchMock as typeof fetch);

    const result = await adapter.listAlerts(
      { apiKey: "test-key", region: "EU" },
      { status: "open", limit: 5 },
    );
    expect(result).toEqual({
      alerts: [
        expect.objectContaining({
          id: "alert-1",
          message: "Database unavailable",
          status: "open",
        }),
      ],
      count: 1,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.eu.opsgenie.com/v2/alerts?limit=5&sort=createdAt&order=desc&query=status%3Aopen",
    );
    expect(init.headers.Authorization).toBe("GenieKey test-key");
    expect(JSON.stringify(result)).not.toContain("hidden");
  });

  it("rejects arbitrary regions before network access", async () => {
    const fetchMock = jest.fn();
    const adapter = new OpsgenieCloudApiAdapter(fetchMock as typeof fetch);
    await expect(
      adapter.health({ apiKey: "test-key", region: "APAC" as "EU" }),
    ).rejects.toMatchObject<Partial<OpsgenieCloudApiError>>({
      code: "policy_blocked",
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
