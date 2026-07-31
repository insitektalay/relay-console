import { VwoApiAdapter, VwoApiError } from "./vwo-api.adapter";

describe("VwoApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins current-account project discovery and minimizes output", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [{ id: 42, name: "Checkout", environments: [{ id: 9 }] }],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new VwoApiAdapter().read({ apiToken: "customer-token" }, "projects.list"),
    ).resolves.toEqual({
      projects: [{ id: "42", name: "Checkout" }],
      truncated: false,
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(
      new URL("https://app.vwo.com/api/v2/accounts/current/projects"),
    );
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ token: "customer-token" }),
        redirect: "error",
      }),
    );
  });

  it("blocks campaign and write operations before making a request", () => {
    expect(() =>
      new VwoApiAdapter().read({ apiToken: "token" }, "campaigns.list"),
    ).toThrow(VwoApiError);
  });
});
