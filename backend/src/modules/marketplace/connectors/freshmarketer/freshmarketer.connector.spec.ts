import { FRESHMARKETER_CONNECTOR_MANIFEST } from "./freshmarketer.connector";
import {
  FreshmarketerApiAdapter,
  FreshmarketerApiError,
} from "./freshmarketer-api.adapter";

const credentials = {
  bundleUrl: "https://relay.myfreshworks.com/crm/marketing",
  apiKey: "test-api-key",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("Freshmarketer connector", () => {
  it("publishes identity-free reads and an approval-gated CRM API broker", () => {
    expect(FRESHMARKETER_CONNECTOR_MANIFEST.slug).toBe("freshmarketer");
    expect(FRESHMARKETER_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
    expect(
      FRESHMARKETER_CONNECTOR_MANIFEST.tools.map((tool) => tool.name),
    ).toEqual([
      "freshmarketer.listContactFilters",
      "freshmarketer.listContactMetadata",
      "freshmarketer.request",
    ]);
    expect(
      FRESHMARKETER_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.approvalRequired,
      ),
    ).toBe(true);
  });

  it("binds token auth to the exact CRM bundle and lists view metadata", async () => {
    const requester = jest.fn(async (url: string | URL, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://relay.myfreshworks.com/crm/marketing/api/contacts/filters",
      );
      expect(init.headers).toMatchObject({
        Authorization: "Token token=test-api-key",
      });
      return response({ filters: [{ id: 3, name: "All Contacts" }] });
    });
    await expect(
      new FreshmarketerApiAdapter(requester).listContactFilters(credentials),
    ).resolves.toEqual({
      filters: [{ filterId: 3, name: "All Contacts" }],
    });
  });

  it("projects one fixed first page without contact identity or details", async () => {
    const requester = jest.fn(async (url: string | URL) => {
      const parsed = new URL(String(url));
      expect(parsed.pathname).toBe("/crm/marketing/api/contacts/view/3");
      expect(parsed.searchParams.get("page")).toBe("1");
      return response({
        contacts: [
          {
            id: 41,
            lead_score: 8,
            marketing_status: "marketing",
            subscription_status: "subscribed",
            email: "private@example.com",
            display_name: "Private",
            mobile_number: "private",
            custom_field: { private: true },
            updated_at: "2026-07-18T09:00:00Z",
          },
        ],
        meta: { total: 1 },
      });
    });
    const result = await new FreshmarketerApiAdapter(
      requester,
    ).listContactMetadata(credentials, { viewId: 3, limit: 2 });
    expect(result.contacts[0]).toMatchObject({
      contactId: 41,
      leadScore: 8,
      marketingStatus: "marketing",
      subscriptionStatus: "subscribed",
    });
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("allows bounded relative API requests and redacts secrets", async () => {
    const result = await new FreshmarketerApiAdapter(async () =>
      response({ access_token: "provider-secret" }),
    ).request(credentials, {
      method: "GET",
      path: "/api/settings/contacts/fields",
    });
    expect(JSON.stringify(result)).toContain("[redacted]");
    expect(JSON.stringify(result)).not.toContain("provider-secret");
  });

  it("rejects hostile bundles, paths, credential fields, and oversized responses", async () => {
    const adapter = new FreshmarketerApiAdapter(
      async () => new Response("x".repeat(2_000_001), { status: 200 }),
    );
    await expect(
      adapter.health({
        ...credentials,
        bundleUrl: "https://relay.myfreshworks.com.evil/crm/marketing",
      }),
    ).rejects.toBeInstanceOf(FreshmarketerApiError);
    await expect(
      adapter.request(credentials, { method: "GET", path: "/api/../admin" }),
    ).rejects.toBeInstanceOf(FreshmarketerApiError);
    await expect(
      adapter.request(credentials, {
        method: "POST",
        path: "/api/contacts",
        json: { apiKey: "no" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(adapter.health(credentials)).rejects.toMatchObject({
      code: "provider_validation_error",
    });
  });
});
