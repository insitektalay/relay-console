import { KayakoApiAdapter, KayakoApiError } from "./kayako-api.adapter";
import { KAYAKO_CONNECTOR_MANIFEST } from "./kayako.connector";

const credentials = {
  domain: "relay-support",
  accessToken: "test-access-token",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Kayako connector", () => {
  it("publishes content-free reads and an approval-gated API broker", () => {
    expect(KAYAKO_CONNECTOR_MANIFEST.tools.map((tool) => tool.name)).toEqual([
      "kayako.listCases",
      "kayako.getCase",
      "kayako.request",
    ]);
    expect(
      KAYAKO_CONNECTOR_MANIFEST.tools.every((tool) => tool.approvalRequired),
    ).toBe(true);
  });

  it("binds Bearer auth to the exact tenant and strips private data", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://relay-support.kayako.com/api/v1/cases.json?offset=0&limit=2",
      );
      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-access-token",
      });
      return response({
        status: 200,
        total_count: 3,
        data: [
          {
            id: 41,
            subject: "Private subject",
            requester: { email: "private@example.com" },
            posts: [{ contents: "Private body" }],
            state: "ACTIVE",
            status: { id: 2, title: "Private label" },
            priority: { id: 3 },
            type: { id: 4 },
            post_count: 2,
            has_notes: true,
            has_attachments: false,
            is_merged: false,
            created_at: "2026-07-18T10:00:00Z",
            updated_at: "2026-07-18T11:00:00Z",
          },
        ],
      });
    });
    const result = await new KayakoApiAdapter(requester).listCases(
      credentials,
      { limit: 2 },
    );
    expect(result).toEqual({
      cases: [
        expect.objectContaining({
          caseId: 41,
          state: "ACTIVE",
          statusId: 2,
          postCount: 2,
        }),
      ],
      hasMore: true,
      limit: 2,
    });
    expect(JSON.stringify(result)).not.toContain("Private");
    expect(JSON.stringify(result)).not.toContain("requester");
  });

  it("reads one exact case through the same projection", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      expect(new URL(String(url)).pathname).toBe("/api/v1/cases/72.json");
      return response({
        status: 200,
        data: { id: 72, state: "CLOSED", subject: "private" },
      });
    });
    await expect(
      new KayakoApiAdapter(requester).getCase(credentials, 72),
    ).resolves.toMatchObject({ case: { caseId: 72, state: "CLOSED" } });
  });

  it("redacts secrets from broader responses", async () => {
    const result = await new KayakoApiAdapter(async () =>
      response({ access_token: "provider-secret" }),
    ).request(credentials, { method: "GET", path: "/api/v1/profile.json" });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile tenants, paths, credential fields, and oversized responses", async () => {
    const adapter = new KayakoApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({ ...credentials, domain: "relay.kayako.com.evil" }),
    ).rejects.toBeInstanceOf(KayakoApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/v1/../admin" }),
    ).rejects.toBeInstanceOf(KayakoApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/v1/cases.json",
        json: { accessToken: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.health({ ...credentials, accessToken: "" }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
