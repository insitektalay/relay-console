import { DeputyApiAdapter, DeputyApiError } from "./deputy-api.adapter";
import {
  DEPUTY_OPERATION_BY_ID,
  DEPUTY_READ_OPERATION_IDS,
  DEPUTY_WRITE_OPERATION_IDS,
} from "./deputy-operation-registry";

describe("DeputyApiAdapter", () => {
  const adapter = new DeputyApiAdapter();
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("accepts only documented customer-install authorities", () => {
    expect(adapter.normalizeApiOrigin("acme.uk.deputy.com")).toBe(
      "https://acme.uk.deputy.com",
    );
    expect(() => adapter.normalizeApiOrigin("https://deputy.com")).toThrow(
      DeputyApiError,
    );
    expect(() =>
      adapter.normalizeApiOrigin("https://acme.uk.deputy.com.evil.test"),
    ).toThrow(DeputyApiError);
    expect(() =>
      adapter.normalizeApiOrigin("https://user@acme.uk.deputy.com"),
    ).toThrow(DeputyApiError);
  });

  it("pins a documented read to the OAuth-bound install", async () => {
    const operationId = DEPUTY_READ_OPERATION_IDS[0];
    const operation = DEPUTY_OPERATION_BY_ID.get(operationId)!;
    const pathParameters = Object.fromEntries(
      operation.pathParameters.map((name) => [name, "1"]),
    );
    global.fetch = jest.fn(async (url: URL | RequestInfo) => {
      expect(new URL(String(url)).origin).toBe("https://acme.au.deputy.com");
      expect(new URL(String(url)).pathname).toMatch(/^\/api\/v[12]\//);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    await expect(
      adapter.read("token", "acme.au.deputy.com", operationId, {
        pathParameters,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects writes through the read tool and credential-shaped input", async () => {
    expect(() =>
      adapter.read(
        "token",
        "acme.us.deputy.com",
        DEPUTY_WRITE_OPERATION_IDS[0],
        {},
      ),
    ).toThrow(expect.objectContaining({ code: "provider_validation_error" }));

    await expect(
      adapter.manage(
        "token",
        "acme.us.deputy.com",
        DEPUTY_WRITE_OPERATION_IDS[0],
        { body: { accessToken: "do-not-forward" } },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
