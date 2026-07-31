import { MixpanelApiAdapter } from "./mixpanel-api.adapter";

const credentials = {
  apiOrigin: "https://eu.mixpanel.com",
  serviceAccountUsername: "relay.service",
  serviceAccountSecret: "private-mixpanel-secret",
  projectId: "12345",
};
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MixpanelApiAdapter", () => {
  it("validates Service Account authentication and exact Project authority", async () => {
    const request = jest.fn(async () =>
      response({ status: "ok", results: [] }),
    );
    const result = await new MixpanelApiAdapter(request).health(credentials);
    expect(request).toHaveBeenCalledTimes(2);
    const calls = request.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([url]) => url)).toEqual([
      "https://eu.mixpanel.com/api/app/me",
      "https://eu.mixpanel.com/api/app/projects/12345/annotations?fromDate=2000-01-01&toDate=2000-01-01",
    ]);
    expect(calls[0][1].headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("relay.service:private-mixpanel-secret").toString("base64")}`,
    });
    expect(result).toEqual({
      apiOrigin: "https://eu.mixpanel.com",
      projectId: "12345",
      reachable: true,
    });
  });

  it("lists bounded Cohort aggregates without names or descriptions", async () => {
    const request = jest.fn(async () =>
      response([
        {
          id: 1000,
          project_id: 12345,
          count: 150,
          is_visible: 1,
          created: "2026-07-01 10:00:00",
          name: "Private cohort",
          description: "private definition",
        },
      ]),
    );
    const result = await new MixpanelApiAdapter(request).listCohorts(
      credentials,
    );
    const [url, init] = request.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://eu.mixpanel.com/api/query/cohorts/list?project_id=12345",
    );
    expect(init.method).toBe("POST");
    expect(result.cohorts[0]).toEqual({
      cohortId: "1000",
      projectId: "12345",
      count: 150,
      isVisible: true,
      createdAt: "2026-07-01 10:00:00",
    });
    expect(JSON.stringify(result)).not.toContain("Private cohort");
    expect(JSON.stringify(result)).not.toContain("definition");
  });

  it("lists bounded Annotation lifecycle metadata without descriptions, users, or tags", async () => {
    const request = jest.fn(async () =>
      response({
        status: "ok",
        results: [
          {
            id: 7,
            date: "2026-07-10 09:00:00",
            description: "Private release",
            user: { first_name: "Private" },
            tags: [{ name: "private" }],
          },
        ],
      }),
    );
    const result = await new MixpanelApiAdapter(request).listAnnotations(
      credentials,
      { fromDate: "2026-07-01", toDate: "2026-07-31" },
    );
    expect(result.annotations[0]).toEqual({
      annotationId: "7",
      date: "2026-07-10 09:00:00",
    });
    expect(JSON.stringify(result)).not.toContain("Private release");
    expect(JSON.stringify(result)).not.toContain("user");
    expect(JSON.stringify(result)).not.toContain("tags");
  });

  it("rejects unknown origins and ranges longer than 31 days", async () => {
    const request = jest.fn();
    const adapter = new MixpanelApiAdapter(request);
    await expect(
      adapter.health({ ...credentials, apiOrigin: "https://example.com" }),
    ).rejects.toMatchObject({ code: "mixpanel_api_origin_invalid" });
    await expect(
      adapter.listAnnotations(credentials, {
        fromDate: "2026-01-01",
        toDate: "2026-03-01",
      }),
    ).rejects.toMatchObject({ code: "mixpanel_date_range_invalid" });
    expect(request).not.toHaveBeenCalled();
  });
});
