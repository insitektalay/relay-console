import {
  PostscriptApiAdapter,
  type PostscriptCredentials,
} from "./postscript-api.adapter";
import {
  POSTSCRIPT_MANAGE_OPERATION_IDS,
  POSTSCRIPT_OPERATIONS,
  POSTSCRIPT_SAFE_READ_OPERATION_IDS,
  POSTSCRIPT_SENSITIVE_READ_OPERATION_IDS,
} from "./postscript-operation-registry";

describe("PostscriptApiAdapter", () => {
  const credentials: PostscriptCredentials = { apiKey: "shop-private-key" };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 20 agent-safe operations and 6/4/10 policy split", () => {
    expect(POSTSCRIPT_OPERATIONS).toHaveLength(20);
    expect(POSTSCRIPT_SAFE_READ_OPERATION_IDS).toHaveLength(6);
    expect(POSTSCRIPT_SENSITIVE_READ_OPERATION_IDS).toHaveLength(4);
    expect(POSTSCRIPT_MANAGE_OPERATION_IDS).toHaveLength(10);
  });

  it("pins the v2 origin, bearer boundary, and first subscriber page", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );
    await new PostscriptApiAdapter().read(credentials, "list_subscribers", {
      query: {},
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.postscript.io/api/v2/subscribers?page=1",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer shop-private-key",
      }),
      redirect: "error",
    });
  });

  it("blocks signing-token, arbitrary-page, cross-policy, and credential-bearing inputs", async () => {
    const adapter = new PostscriptApiAdapter();
    expect(() =>
      adapter.read(credentials, "get_webhook_signing_token", {}),
    ).toThrow();
    expect(() => adapter.read(credentials, "send_message", {})).toThrow();
    await expect(
      adapter.read(credentials, "list_subscribers", { query: { page: 2 } }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, "create_webhook", {
        body: { callback_url: "https://hooks.example/event?token=leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
