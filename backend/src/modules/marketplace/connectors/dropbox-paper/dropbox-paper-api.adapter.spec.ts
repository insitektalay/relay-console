import {
  DropboxPaperApiAdapter,
  DropboxPaperApiError,
} from "./dropbox-paper-api.adapter";

describe("DropboxPaperApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins JSON reads to Dropbox API and uses bearer auth", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ account_id: "dbid:fixture" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await new DropboxPaperApiAdapter().read(
      "fixture-access-token",
      "/users/get_current_account",
      {},
    );
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.dropboxapi.com/2/users/get_current_account",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer fixture-access-token");
  });

  it("uses the content origin and Dropbox-API-Arg for .paper creation", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "dropbox-api-result": JSON.stringify({ file_id: "id:paper" }),
        },
      }),
    );
    await new DropboxPaperApiAdapter().write(
      "fixture-access-token",
      "/files/paper/create",
      { path: "/Plan.paper", import_format: "markdown" },
      "# Plan",
    );
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toBe(
      "https://content.dropboxapi.com/2/files/paper/create",
    );
    expect(call[1]?.body).toBe("# Plan");
    expect(
      JSON.parse(
        (call[1]?.headers as Record<string, string>)["Dropbox-API-Arg"],
      ),
    ).toEqual({ path: "/Plan.paper", import_format: "markdown" });
  });

  it("rejects route confusion, misplaced content, and nested credentials", async () => {
    const adapter = new DropboxPaperApiAdapter();
    await expect(
      Promise.resolve().then(() =>
        adapter.read("fixture", "/files/paper/create", {}),
      ),
    ).rejects.toMatchObject<Partial<DropboxPaperApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      Promise.resolve().then(() =>
        adapter.write("fixture", "/sharing/add_file_member", {}, "not allowed"),
      ),
    ).rejects.toMatchObject<Partial<DropboxPaperApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      Promise.resolve().then(() =>
        adapter.read("fixture", "/files/list_folder", {
          nested: { accessToken: "stolen" },
        }),
      ),
    ).rejects.toMatchObject<Partial<DropboxPaperApiError>>({
      code: "policy_blocked",
    });
  });

  it("maps Dropbox failures safely and redacts returned secrets", async () => {
    jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error_summary: "rate_limited/..." }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      new DropboxPaperApiAdapter().getCurrentAccount("fixture"),
    ).rejects.toMatchObject<Partial<DropboxPaperApiError>>({
      code: "provider_rate_limited",
      message: "rate_limited/...",
    });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ account_id: "dbid:fixture", access_token: "bad" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    await expect(
      new DropboxPaperApiAdapter().getCurrentAccount("fixture"),
    ).resolves.toEqual({
      account_id: "dbid:fixture",
      access_token: "[redacted]",
    });
  });
});
