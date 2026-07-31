import { LedgyApiAdapter, LedgyApiError } from "./ledgy-api.adapter";

const credentials = { apiKey: "key" };

describe("LedgyApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the GraphQL auth query and minimizes company identity", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            auth: {
              companyId: "company_1",
              companyName: "Example Company",
              privateField: "hidden",
            },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      new LedgyApiAdapter().read(credentials, { operation: "auth.company" }),
    ).resolves.toEqual({
      company: { id: "company_1", name: "Example Company" },
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://app.ledgy.com/graphql");
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const payload = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(payload.operationName).toBe("RelayAuth");
    expect(payload.variables).toEqual({});
    expect(payload.query).toContain("auth");
    expect(payload.query).toContain("companyId");
    expect(payload.query).toContain("companyName");
    expect(payload.query).not.toContain("mutation");
    expect(payload.query).not.toContain("__schema");
  });

  it("rejects arbitrary operations and invalid credentials", async () => {
    const adapter = new LedgyApiAdapter();
    await expect(
      adapter.read(credentials, { operation: "companyCaptable" }),
    ).rejects.toBeInstanceOf(LedgyApiError);
    await expect(
      adapter.read({ apiKey: "bad\nkey" }, { operation: "auth.company" }),
    ).rejects.toBeInstanceOf(LedgyApiError);
  });
});
