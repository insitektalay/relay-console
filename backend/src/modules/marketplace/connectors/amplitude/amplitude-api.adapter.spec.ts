import { AmplitudeApiAdapter } from "./amplitude-api.adapter";

const credentials = {
  apiOrigin: "https://analytics.eu.amplitude.com",
  projectApiKey: "project-api-key",
  projectSecretKey: "private-amplitude-secret",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AmplitudeApiAdapter", () => {
  it("validates exact regional origin and Project API/Secret Keys without returning event names", async () => {
    const request = jest.fn(async () =>
      response({ data: [{ event_type: "Private Event", totals: 99 }] }),
    );
    const result = await new AmplitudeApiAdapter(request).health(credentials);
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://analytics.eu.amplitude.com/api/2/events/list");
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("project-api-key:private-amplitude-secret").toString("base64")}`,
    });
    expect(result).toEqual({
      apiOrigin: credentials.apiOrigin,
      projectKeyBound: true,
      reachable: true,
    });
    expect(JSON.stringify(result)).not.toContain("Private Event");
  });

  it("reads a fixed unsegmented daily active/new user series", async () => {
    const request = jest.fn(async () =>
      response({
        data: {
          series: [[100, 120]],
          seriesMeta: ["Private segment"],
          xValues: ["2026-07-01", "2026-07-02"],
        },
      }),
    );
    const result = await new AmplitudeApiAdapter(request).getDailyUsers(
      credentials,
      { fromDate: "2026-07-01", toDate: "2026-07-02", mode: "active" },
    );
    const url = new URL(
      (request.mock.calls[0] as unknown as [string, RequestInit])[0],
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      start: "20260701",
      end: "20260702",
      m: "active",
      i: "1",
    });
    expect(result).toEqual({
      mode: "active",
      fromDate: "2026-07-01",
      toDate: "2026-07-02",
      dates: ["2026-07-01", "2026-07-02"],
      values: [100, 120],
    });
    expect(JSON.stringify(result)).not.toContain("Private segment");
  });

  it("reads a bounded average-session-length series without segment labels", async () => {
    const request = jest.fn(async () =>
      response({
        data: {
          series: [[42.5, 41]],
          seriesMeta: ["Private"],
          xValues: ["2026-07-01", "2026-07-02"],
        },
      }),
    );
    const result = await new AmplitudeApiAdapter(
      request,
    ).getAverageSessionLength(credentials, {
      fromDate: "2026-07-01",
      toDate: "2026-07-02",
    });
    expect(result.averageSeconds).toEqual([42.5, 41]);
    expect(JSON.stringify(result)).not.toContain("Private");
  });

  it("rejects arbitrary origins and date ranges longer than 31 days", async () => {
    const request = jest.fn();
    const adapter = new AmplitudeApiAdapter(request);
    await expect(
      adapter.health({
        ...credentials,
        apiOrigin: "https://analytics.amplitude.com",
      }),
    ).rejects.toMatchObject({ code: "amplitude_api_origin_invalid" });
    await expect(
      adapter.getDailyUsers(credentials, {
        fromDate: "2026-01-01",
        toDate: "2026-02-15",
        mode: "active",
      }),
    ).rejects.toMatchObject({ code: "amplitude_date_range_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
});
