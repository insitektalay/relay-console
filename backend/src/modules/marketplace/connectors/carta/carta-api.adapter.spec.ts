import { CartaApiAdapter, CartaApiError } from "./carta-api.adapter";

const credentials = { clientId: "client", clientSecret: "secret" };

describe("CartaApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("mints an exact read-only token and minimizes a bounded firm page", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "token" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            firms: [
              {
                id: "7af7123a-2ee9-4e31-a173-54b8f9159426",
                name: "Krakatoa Ventures",
                privateField: "hidden",
              },
            ],
            nextPageToken: "ODMxMw==",
          }),
          { status: 200 },
        ),
      );

    await expect(
      new CartaApiAdapter().read(credentials, {
        operation: "investor.firms.list",
        pageSize: 20,
        pageToken: "cursor_1",
      }),
    ).resolves.toEqual({
      firms: [
        {
          id: "7af7123a-2ee9-4e31-a173-54b8f9159426",
          name: "Krakatoa Ventures",
        },
      ],
      pageSize: 20,
      nextPageToken: "ODMxMw==",
    });

    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://login.app.carta.com/o/access_token/",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("client:secret").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        }),
        body: "scope=read_investor_firms&grant_type=CLIENT_CREDENTIALS",
      }),
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://api.carta.com/v1alpha1/investors/firms?pageSize=20&pageToken=cursor_1",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("rejects arbitrary operations, oversized pages, and unsafe cursors", async () => {
    const adapter = new CartaApiAdapter();
    await expect(
      adapter.read(credentials, { operation: "investor.funds.list" }),
    ).rejects.toBeInstanceOf(CartaApiError);
    await expect(
      adapter.read(credentials, {
        operation: "investor.firms.list",
        pageSize: 21,
      }),
    ).rejects.toBeInstanceOf(CartaApiError);
    await expect(
      adapter.read(credentials, {
        operation: "investor.firms.list",
        pageToken: "bad cursor?",
      }),
    ).rejects.toBeInstanceOf(CartaApiError);
  });
});
