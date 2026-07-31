import {
  FullstoryApiAdapter,
  FullstoryApiError,
} from "./fullstory-api.adapter";

describe("FullstoryApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins identity and removes seat email, client, and scope details", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          orgId: "ABC",
          role: "USER",
          email: "person@example.com",
          clientId: "private-client",
          scopes: "all",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new FullstoryApiAdapter().read(
        { apiKey: "customer-api-key" },
        "identity.get",
      ),
    ).resolves.toEqual({
      organizationId: "ABC",
      permissionLevel: "standard",
    });
    const [url, request] = fetchSpy.mock.calls[0]!;
    expect(url).toEqual(new URL("https://api.fullstory.com/me"));
    expect(request).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Basic customer-api-key",
        }),
        redirect: "error",
      }),
    );
  });

  it("blocks user, session, export, and write operations", () => {
    expect(() =>
      new FullstoryApiAdapter().read({ apiKey: "key" }, "users.list"),
    ).toThrow(FullstoryApiError);
  });
});
