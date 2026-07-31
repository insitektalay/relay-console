import { PadletApiAdapter, PadletApiError } from "./padlet-api.adapter";

describe("PadletApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { apiKey: "fixture-token" };

  it("pins the official origin, uses the API-key header, and bounds board relationships", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: {} }), { status: 200 }),
      );
    await new PadletApiAdapter().getBoard(credentials, {
      boardId: "abcd1234efgh5678",
      include: ["posts", "comments"],
    });
    const request = fetchMock.mock.calls[0];
    const url = new URL(String(request[0]));
    expect(url.origin + url.pathname).toBe(
      "https://api.padlet.dev/v1/boards/abcd1234efgh5678",
    );
    expect(url.searchParams.get("include")).toBe("posts,comments");
    expect((request[1]?.headers as Record<string, string>)["x-api-key"]).toBe(
      "fixture-token",
    );
  });

  it("constructs the exact JSON:API post route and body", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "post123" } }), {
          status: 201,
        }),
      );
    await new PadletApiAdapter().createPost(credentials, {
      boardId: "abcd1234efgh5678",
      content: { subject: "Plan" },
      sectionId: "section1234567890",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.padlet.dev/v1/boards/abcd1234efgh5678/posts",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      data: {
        type: "post",
        attributes: { content: { subject: "Plan" } },
        relationships: {
          section: { data: { id: "section1234567890", type: "section" } },
        },
      },
    });
  });

  it("rejects invalid relationships and credential-bearing payload fields", async () => {
    const adapter = new PadletApiAdapter();
    await expect(
      Promise.resolve().then(() =>
        adapter.getBoard(credentials, {
          boardId: "abcd1234efgh5678",
          include: ["owners"],
        }),
      ),
    ).rejects.toMatchObject<Partial<PadletApiError>>({
      code: "provider_validation_error",
    });
    await expect(
      Promise.resolve().then(() =>
        adapter.createPost(credentials, {
          boardId: "abcd1234efgh5678",
          content: { subject: "Plan", apiKey: "stolen" },
        }),
      ),
    ).rejects.toMatchObject<Partial<PadletApiError>>({
      code: "policy_blocked",
    });
  });

  it("maps Padlet errors safely and redacts credential-shaped response fields", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              { detail: "Too many requests", code: "RATE_LIMIT_EXCEEDED" },
            ],
          }),
          { status: 429 },
        ),
      );
    await expect(
      new PadletApiAdapter().getCurrentUser(credentials),
    ).rejects.toMatchObject<Partial<PadletApiError>>({
      code: "provider_rate_limited",
      message: "Too many requests",
    });
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { apiKey: "secret", name: "Alex" } }),
          { status: 200 },
        ),
      );
    await expect(
      new PadletApiAdapter().getCurrentUser(credentials),
    ).resolves.toEqual({ data: { apiKey: "[redacted]", name: "Alex" } });
  });
});
