import { FigmaApiAdapter, FigmaApiError } from "./figma-api.adapter";

describe("FigmaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins bounded reads to the official Figma API origin", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ name: "Design system", document: {} }), {
          status: 200,
        }),
      );
    await new FigmaApiAdapter().callRead("oauth-token", {
      path: "/v1/files/file_123",
      query: { depth: 2 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.figma.com/v1/files/file_123?depth=2",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("rejects arbitrary routes and credential-bearing payloads", async () => {
    const adapter = new FigmaApiAdapter();
    await expect(
      adapter.callRead("oauth-token", { path: "/v1/payments" }),
    ).rejects.toBeInstanceOf(FigmaApiError);
    await expect(
      adapter.callWrite("oauth-token", {
        method: "POST",
        path: "/v1/files/file_123/comments",
        json: { message: "Review", access_token: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
