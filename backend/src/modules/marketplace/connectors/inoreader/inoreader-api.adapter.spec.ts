import { InoreaderApiAdapter, InoreaderApiError } from "./inoreader-api.adapter";

describe("InoreaderApiAdapter", () => {
  const api = new InoreaderApiAdapter();

  afterEach(() => jest.restoreAllMocks());

  it("uses only www.inoreader.com with bearer authorization", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ userId: "1001", userName: "Alex" }), {
        status: 200,
      }),
    );
    await api.getUserInfo("secret-access-token");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://www.inoreader.com/reader/api/0/user-info",
    );
    expect(
      (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)
        .Authorization,
    ).toBe("Bearer secret-access-token");
  });

  it("bounds stream reads and preserves the stream identifier", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    await api.streamContents("token", {
      streamId: "user/-/state/com.google/reading-list",
      count: 5_000,
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("s")).toBe(
      "user/-/state/com.google/reading-list",
    );
    expect(url.searchParams.get("n")).toBe("100");
  });

  it("encodes mutation fields as provider-required form data", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("OK", { status: 200 }));
    await api.request("token", {
      method: "POST",
      path: "/reader/api/0/edit-tag",
      fields: { i: "tag:google.com,2005:reader/item/1", a: "user/-/state/com.google/starred" },
    });
    expect(String(fetchMock.mock.calls[0][1]?.body)).toContain("a=user%2F-%2Fstate");
  });

  it("rejects traversal and credential-bearing fields before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      api.request("token", {
        method: "GET",
        path: "/reader/api/0/../user-info",
      }),
    ).rejects.toMatchObject<Partial<InoreaderApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      api.request("token", {
        method: "POST",
        path: "/reader/api/0/edit-tag",
        fields: { access_token: "leak" },
      }),
    ).rejects.toMatchObject<Partial<InoreaderApiError>>({
      code: "policy_blocked",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
