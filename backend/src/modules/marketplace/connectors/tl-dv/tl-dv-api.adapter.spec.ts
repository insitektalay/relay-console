import { TlDvApiAdapter, TlDvApiError } from "./tl-dv-api.adapter";

describe("TlDvApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiKey: "fixture-key" };

  it("pins the official origin, injects x-api-key, and bounds meeting lists", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new TlDvApiAdapter().listMeetings(credentials, { limit: 1000 });
    const [request, init] = fetchMock.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://pasta.tldv.io/v1alpha1/meetings");
    expect(url.searchParams.get("limit")).toBe("20");
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("fixture-key");
  });

  it("blocks alternate paths, credential injection, and private import URLs", async () => {
    const adapter = new TlDvApiAdapter();
    await expect(adapter.request(credentials, { method: "GET", path: "/../oauth" })).rejects.toMatchObject<Partial<TlDvApiError>>({ code: "provider_validation_error" });
    await expect(adapter.request(credentials, { method: "POST", path: "/meetings/import", json: { api_key: "stolen" } })).rejects.toMatchObject<Partial<TlDvApiError>>({ code: "policy_blocked" });
    expect(() => adapter.importMeeting(credentials, { name: "Internal", url: "https://127.0.0.1/media.mp4" })).toThrow(expect.objectContaining({ code: "policy_blocked" }));
  });

  it("redacts signed download URLs and does not follow download redirects", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://signed.example/secret" } }),
    );
    await expect(
      new TlDvApiAdapter().getRecordingDownload(credentials, { meetingId: "meeting-123" }),
    ).resolves.toEqual({
      status: "download_ready",
      message: "tl;dv prepared the recording download. The signed location is withheld from agent output.",
    });
  });
});
