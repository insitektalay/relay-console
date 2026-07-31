import { NozbeApiAdapter, NozbeApiError } from "./nozbe-api.adapter";

describe("NozbeApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the fixed Nozbe origin and server-held API token", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: "Launch" }]), {
        status: 200,
      }),
    );
    await new NozbeApiAdapter().read(
      { apiKey: "access-token" },
      {
        path: "/projects",
        query: { is_favorite: true, limit: 25 },
      },
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api4.nozbe.com/v1/api/projects?is_favorite=true&limit=25",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("apikey access-token");
  });

  it("supports bounded JSON mutations and multipart uploads", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 2 }), { status: 200 }),
      );
    const api = new NozbeApiAdapter();
    await api.manage(
      { apiKey: "token" },
      {
        method: "POST",
        path: "/tasks",
        json: { name: "Ship", project_id: "project-10" },
      },
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ship", project_id: "project-10" }),
      }),
    );
    await api.manage(
      { apiKey: "token" },
      {
        method: "POST",
        path: "/comments/comment-2/attachment_with_content",
        contentType: "form",
        form: { name: "brief.txt" },
        files: [
          {
            fieldName: "file",
            name: "brief.txt",
            mimeType: "text/plain",
            base64: Buffer.from("brief").toString("base64"),
          },
        ],
      },
    );
    expect(fetchMock.mock.calls[1][1]?.body).toBeInstanceOf(FormData);
  });

  it("blocks traversal, unsupported families, and credential-bearing input", async () => {
    const api = new NozbeApiAdapter();
    await expect(
      api.read({ apiKey: "token" }, { path: "/projects/../oauth" }),
    ).rejects.toBeInstanceOf(NozbeApiError);
    await expect(
      api.read({ apiKey: "token" }, { path: "/billing" }),
    ).rejects.toBeInstanceOf(NozbeApiError);
    await expect(
      api.manage(
        { apiKey: "token" },
        {
          method: "POST",
          path: "/tasks",
          json: { accessToken: "no" },
        },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts credential-like fields and maps throttling safely", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 1, access_token: "secret" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Slow down" }), {
          status: 429,
        }),
      );
    await expect(
      new NozbeApiAdapter().health({ apiKey: "token" }),
    ).resolves.toEqual({ id: 1, access_token: "[redacted]" });
    await expect(
      new NozbeApiAdapter().health({ apiKey: "token" }),
    ).rejects.toMatchObject({
      code: "provider_rate_limited",
      statusCode: 429,
    });
  });
});
