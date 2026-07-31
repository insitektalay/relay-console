import {
  AttentiveApiAdapter,
  type AttentiveCredentials,
} from "./attentive-api.adapter";
import {
  ATTENTIVE_MANAGE_OPERATION_IDS,
  ATTENTIVE_OPERATIONS,
  ATTENTIVE_SAFE_READ_OPERATION_IDS,
  ATTENTIVE_SENSITIVE_READ_OPERATION_IDS,
} from "./attentive-operation-registry";

describe("AttentiveApiAdapter", () => {
  const credentials: AttentiveCredentials = { apiKey: "private-app-key" };
  afterEach(() => jest.restoreAllMocks());

  it("pins the complete 32-operation v1/v2 surface and policy split", () => {
    expect(ATTENTIVE_OPERATIONS).toHaveLength(32);
    expect(ATTENTIVE_SAFE_READ_OPERATION_IDS).toHaveLength(8);
    expect(ATTENTIVE_SENSITIVE_READ_OPERATION_IDS).toHaveLength(3);
    expect(ATTENTIVE_MANAGE_OPERATION_IDS).toHaveLength(21);
  });

  it("pins the API origin, bearer boundary, and bounded segment page", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ segments: [] }), {
        status: 200,
        headers: { "x-ratelimit-limit": "100" },
      }),
    );
    await new AttentiveApiAdapter().read(credentials, "list_segments", {
      query: {},
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.attentivemobile.com/v2/segments?limit=20",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({
        Authorization: "Bearer private-app-key",
      }),
      redirect: "error",
    });
  });

  it("rejects unknown operations, cross-policy calls, arbitrary queries, and secret fields", async () => {
    const adapter = new AttentiveApiAdapter();
    expect(() => adapter.read(credentials, "send_message", {})).toThrow();
    expect(() => adapter.read(credentials, "create_webhook", {})).toThrow();
    await expect(
      adapter.read(credentials, "list_segments", {
        query: { redirect_uri: "https://evil.example" },
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.manage(credentials, "post_custom_event", {
        body: { event: "purchase", apiKey: "leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "create_webhook", {
        body: { url: "https://hooks.example/event?token=leak" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("redacts bulk-result downloads", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "COMPLETED",
          url: "https://download.example/results.jsonl",
        }),
        { status: 200 },
      ),
    );
    const result = await new AttentiveApiAdapter().read(
      credentials,
      "get_bulk_job_status",
      { pathParams: { bulkJobId: "job-1" } },
    );
    expect(result.data).toEqual({ status: "COMPLETED", url: "[REDACTED]" });
  });
});
