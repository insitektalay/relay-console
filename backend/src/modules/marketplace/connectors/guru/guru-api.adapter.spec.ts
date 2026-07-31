import { GuruApiAdapter, GuruApiError } from "./guru-api.adapter";

describe("GuruApiAdapter", () => {
  const api = new GuruApiAdapter();
  afterEach(() => jest.restoreAllMocks());

  it("uses only api.getguru.com v1 with OAuth bearer authorization", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ id: "team_1" }]), { status: 200 }));
    await api.listTeams("oauth_secret");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.getguru.com/api/v1/teams");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer oauth_secret");
  });

  it("bounds Card search and returns only the same-origin next-page token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify([{ id: "card_1" }]), { status: 200, headers: { Link: '<https://api.getguru.com/api/v1/search/query?token=next_safe>; rel="next-page"' } }));
    await expect(api.searchCards("token", { query: "OAuth", maxResults: 999 })).resolves.toEqual({ data: [{ id: "card_1" }], nextPageToken: "next_safe" });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("maxResults")).toBe("50");
    expect(url.searchParams.get("searchTerms")).toBe("OAuth");
  });

  it("rejects traversal and credential-bearing fields before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(api.request("token", { method: "GET", path: "/api/v1/cards/../teams" })).rejects.toMatchObject<Partial<GuruApiError>>({ code: "provider_validation_error" });
    await expect(api.request("token", { method: "POST", path: "/api/v1/cards", json: { apiToken: "leak" } })).rejects.toMatchObject<Partial<GuruApiError>>({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a bounded file as multipart data", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "attachment_1" }), { status: 201 }));
    await api.uploadFile("token", { path: "/api/v1/attachments", fieldName: "file", filename: "guide.pdf", mimeType: "application/pdf", fileBase64: Buffer.from("pdf").toString("base64") });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.getguru.com/api/v1/attachments");
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
  });
});
