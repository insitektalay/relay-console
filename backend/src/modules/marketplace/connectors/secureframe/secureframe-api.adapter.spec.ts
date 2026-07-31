import {
  SecureframeApiAdapter,
  SecureframeApiError,
} from "./secureframe-api.adapter";

const credentials = { region: "uk", apiKey: "key", apiSecret: "secret" };
describe("SecureframeApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());
  it("pins the regional origin and minimizes a bounded framework page", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "fw_1",
                type: "framework",
                attributes: {
                  name: "SOC 2",
                  status: "active",
                  enabled: true,
                  created_at: "2026-01-01",
                  updated_at: "2026-01-02",
                  private_notes: "hidden",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );
    await expect(
      new SecureframeApiAdapter().read(credentials, {
        operation: "frameworks.list",
        page: 1,
        perPage: 20,
      }),
    ).resolves.toEqual({
      frameworks: [
        {
          id: "fw_1",
          name: "SOC 2",
          status: "active",
          enabled: true,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-02",
        },
      ],
      page: 1,
      perPage: 20,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api-uk.secureframe.com/frameworks?page=1&per_page=20",
    );
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "key secret" }),
      }),
    );
  });
  it("rejects invalid regions, arbitrary operations, and oversized pages", async () => {
    const adapter = new SecureframeApiAdapter();
    await expect(
      adapter.read(
        { ...credentials, region: "eu" },
        { operation: "frameworks.list" },
      ),
    ).rejects.toBeInstanceOf(SecureframeApiError);
    await expect(
      adapter.read(credentials, { operation: "evidences.list" }),
    ).rejects.toBeInstanceOf(SecureframeApiError);
    await expect(
      adapter.read(credentials, { operation: "frameworks.list", perPage: 21 }),
    ).rejects.toBeInstanceOf(SecureframeApiError);
  });
});
