import { PlutioApiAdapter } from "./plutio-api.adapter";
import {
  PLUTIO_MANAGE_OPERATION_IDS,
  PLUTIO_OPERATIONS,
  PLUTIO_READ_OPERATION_IDS,
} from "./plutio-operation-registry";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  businessSubdomain: "studio",
};

describe("PlutioApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the complete documented v1.11 operation split", () => {
    expect(PLUTIO_OPERATIONS).toHaveLength(219);
    expect(PLUTIO_READ_OPERATION_IDS).toHaveLength(40);
    expect(PLUTIO_MANAGE_OPERATION_IDS).toHaveLength(179);
  });

  it("rejects unpinned and cross-tool operations before network access", () => {
    const adapter = new PlutioApiAdapter();
    expect(() => adapter.read(credentials, "not-pinned", {})).toThrow(
      "pinned v1.11 contract",
    );
    expect(() =>
      adapter.read(credentials, PLUTIO_MANAGE_OPERATION_IDS[0], {}),
    ).toThrow("read accepts GET");
    expect(() =>
      adapter.manage(credentials, PLUTIO_READ_OPERATION_IDS[0], {}),
    ).toThrow("manage accepts mutation");
  });

  it("mints a client token, binds the workspace, bounds reads, and redacts secrets", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "temporary-token",
            accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ people: [{ id: "1" }], token: "never-return" }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "x-ratelimit-remaining": "999",
            },
          },
        ),
      );

    const result = await new PlutioApiAdapter().read(
      credentials,
      "person-get-person",
      {},
    );
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      "https://api.plutio.com/v1.11/oauth/token",
    );
    expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
      "https://api.plutio.com/v1.11/people?limit=100",
    );
    expect(fetchSpy.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer temporary-token",
          business: "studio",
        }),
        redirect: "error",
      }),
    );
    expect(result).toEqual({
      data: { people: [{ id: "1" }], token: "[redacted]" },
      rateLimit: { limit: null, remaining: "999", retryAfter: null },
    });
  });

  it("rejects credential-bearing runtime fields", async () => {
    await expect(
      new PlutioApiAdapter().manage(credentials, "task-create-task", {
        json: { client_secret: "never-forward" },
      }),
    ).rejects.toThrow("Credential-bearing field client_secret is not allowed");
  });
});
