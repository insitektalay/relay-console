import { RiversideFmApiAdapter } from "./riverside-fm-api.adapter";

const credentials = { apiKey: "customer-business-key" };

describe("RiversideFmApiAdapter", () => {
  it("uses the fixed v3 origin and header-only bearer auth", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify([{ id: "prod-1", name: "Production", studios: [] }]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const result = await new RiversideFmApiAdapter(request).health(credentials);
    expect(result).toEqual({
      productions: [{ id: "prod-1", name: "Production", studios: [] }],
    });
    expect(request.mock.calls[0][0]).toBe(
      "https://platform.riverside.fm/api/v3/productions",
    );
    expect(request.mock.calls[0][1].headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer customer-business-key",
      }),
    );
  });

  it("bounds recording pages and never follows provider pagination", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            page: 2,
            total_items: 21,
            total_pages: 2,
            next_page_url:
              "https://platform.riverside.fm/api/v3/recordings?page=3",
            data: Array.from({ length: 25 }, (_, index) => ({
              recording_id: `rec-${index}`,
            })),
          }),
          { status: 200 },
        ),
    );
    const result = await new RiversideFmApiAdapter(request).listRecordings(
      credentials,
      { studioId: "studio-1", page: 2 },
    );
    expect(result.data).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain("studioId=studio-1");
  });

  it("maps one attendee registration to the documented v3 body", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(
          JSON.stringify({
            event_id: "event-1",
            join_url: "https://riverside.fm/join/one",
          }),
          { status: 200 },
        ),
    );
    await new RiversideFmApiAdapter(request).registerAttendee(credentials, {
      eventId: "event-1",
      email: "Ada@Example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      customFields: [{ label: "Consent", value: true }],
    });
    expect(JSON.parse(String(request.mock.calls[0][1].body))).toEqual({
      email: "ada@example.com",
      first_name: "Ada",
      last_name: "Lovelace",
      custom_fields: [{ label: "Consent", value: true }],
    });
  });

  it("returns only Riverside-hosted signed download redirects", async () => {
    const request = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(null, {
          status: 301,
          headers: {
            location:
              "https://storage.riverside.fm/signed/file.wav?token=short",
          },
        }),
    );
    const result = await new RiversideFmApiAdapter(
      request,
    ).downloadRecordingFile(credentials, { fileId: "file-1" });
    expect(result).toMatchObject({
      kind: "file",
      id: "file-1",
      shortLived: true,
    });
    expect(request.mock.calls[0][1].redirect).toBe("manual");
  });

  it("fails closed on an external download redirect", async () => {
    const adapter = new RiversideFmApiAdapter(
      async (_url: string, _init: RequestInit) =>
        new Response(null, {
          status: 301,
          headers: { location: "https://attacker.example/file" },
        }),
    );
    await expect(
      adapter.downloadExport(credentials, { exportId: "exp-1" }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
