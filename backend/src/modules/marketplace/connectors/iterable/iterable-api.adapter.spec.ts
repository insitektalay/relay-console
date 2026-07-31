import {
  IterableApiAdapter,
  type IterableCredentials,
} from "./iterable-api.adapter";
import {
  ITERABLE_MANAGE_OPERATION_IDS,
  ITERABLE_OPERATIONS,
  ITERABLE_SAFE_READ_OPERATION_IDS,
  ITERABLE_SENSITIVE_READ_OPERATION_IDS,
} from "./iterable-operation-registry";

describe("IterableApiAdapter", () => {
  const credentials: IterableCredentials = {
    apiKey: "project-server-key",
    region: "eu",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 39 agent-safe operations and 15/8/16 policy split", () => {
    expect(ITERABLE_OPERATIONS).toHaveLength(39);
    expect(ITERABLE_SAFE_READ_OPERATION_IDS).toHaveLength(15);
    expect(ITERABLE_SENSITIVE_READ_OPERATION_IDS).toHaveLength(8);
    expect(ITERABLE_MANAGE_OPERATION_IDS).toHaveLength(16);
  });

  it("pins the EU origin, Api-Key header, and first campaign page", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ campaigns: [] })));
    await new IterableApiAdapter().read(credentials, "list_campaigns", {
      query: {},
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.eu.iterable.com/api/campaigns?page=1&pageSize=50",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({ "Api-Key": "project-server-key" }),
      redirect: "error",
    });
  });

  it("blocks exports, cross-policy use, arbitrary pages, and credential inputs", async () => {
    const adapter = new IterableApiAdapter();
    expect(() => adapter.read(credentials, "export_user_events", {})).toThrow();
    expect(() => adapter.read(credentials, "send_sms", {})).toThrow();
    await expect(
      adapter.read(credentials, "list_templates", { query: { page: 2 } }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, "send_email", {
        body: { dataFeedUrl: "https://feed.example/?token=leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
