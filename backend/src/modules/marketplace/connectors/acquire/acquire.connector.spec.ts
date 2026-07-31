import { AcquireApiAdapter, AcquireApiError } from "./acquire-api.adapter";
import { ACQUIRE_CONNECTOR_MANIFEST } from "./acquire.connector";

const credentials = { accountId: "relay-support", apiKey: "test-api-key" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Acquire connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(ACQUIRE_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "acquire.listCases",
      "acquire.getCase",
      "acquire.request",
    ]);
    expect(
      ACQUIRE_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Bearer auth to the exact account and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://relay-support.acquire.io/api/v1/crm/objects/case?limit=2",
      );
      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-api-key",
      });
      return response({
        data: {
          page: 0,
          offset: 0,
          limit: 2,
          count: 3,
          data: [
            {
              id: 41,
              threadId: 41,
              title: "Private title",
              description: "Private body",
              contact: { email: "private@example.com" },
              messages: [{ message: "Private message" }],
              channel: "chat",
              status: "active",
              closingState: "handled",
              queueId: 7,
              waitTime: 4,
              dateCreated: "2026-07-18T10:00:00Z",
              dateUpdated: "2026-07-18T11:00:00Z",
            },
          ],
        },
      });
    });
    const result = await new AcquireApiAdapter(requester).listCases(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      cases: [
        expect.objectContaining({
          caseId: 41,
          threadId: 41,
          channel: "chat",
          status: "active",
        }),
      ],
      hasMore: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("contact");
  });

  it("reads one exact case through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe("/api/v1/crm/objects/case/72");
      return response({
        data: { id: 72, threadId: 72, status: "closed", title: "private" },
      });
    });
    await expect(
      new AcquireApiAdapter(requester).getCase(credentials, 72),
    ).resolves.toMatchObject({
      case: { caseId: 72, threadId: 72, status: "closed" },
    });
  });

  it("redacts secrets from broader responses", async () => {
    const result = await new AcquireApiAdapter(async () =>
      response({ api_key: "provider-secret" }),
    ).request(credentials, {
      method: "GET",
      path: "/api/v1/account/department",
    });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile accounts, paths, credential fields, and oversized responses", async () => {
    const adapter = new AcquireApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ ...credentials, accountId: "relay.acquire.io.evil" }),
    ).rejects.toBeInstanceOf(AcquireApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/v1/../admin" }),
    ).rejects.toBeInstanceOf(AcquireApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v1/crm/objects/case",
        json: { apiKey: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, apiKey: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
