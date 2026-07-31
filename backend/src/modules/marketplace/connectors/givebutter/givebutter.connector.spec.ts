import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import { GIVEBUTTER_CONNECTOR_MANIFEST } from "./givebutter.connector";
import {
  GIVEBUTTER_BOUNDED_REST_CONNECTOR,
  GIVEBUTTER_OPERATIONS,
} from "./givebutter-operation-registry";

describe("Givebutter connector", () => {
  it("covers the complete pinned public OpenAPI operation surface", () => {
    expect(GIVEBUTTER_OPERATIONS).toHaveLength(61);
    expect(new Set(GIVEBUTTER_OPERATIONS.map((item) => item.id)).size).toBe(61);
    expect(GIVEBUTTER_CONNECTOR_MANIFEST.tools).toHaveLength(2);
    expect(GIVEBUTTER_CONNECTOR_MANIFEST.auth.type).toBe("api_key");
  });

  it("attaches the encrypted API key only to the pinned HTTPS origin", async () => {
    const requester = jest.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: 1 }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      GIVEBUTTER_BOUNDED_REST_CONNECTOR,
      { GIVEBUTTER_API_KEY: "gb_test_secret" },
      "read",
      "campaigns_index",
      { query: { per_page: 25 } },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.toString()).toBe(
      "https://api.givebutter.com/v1/campaigns?per_page=25",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer gb_test_secret",
    );
    expect(init.redirect).toBe("error");
  });

  it("separates reads from approval-gated mutations and rejects credentials in payloads", async () => {
    const requester = jest.fn();
    const adapter = new BoundedRestApiAdapter(requester);
    await expect(
      adapter.execute(
        GIVEBUTTER_BOUNDED_REST_CONNECTOR,
        { GIVEBUTTER_API_KEY: "gb_test_secret" },
        "read",
        "campaigns_destroy",
        { pathParameters: { campaign: "123" } },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        GIVEBUTTER_BOUNDED_REST_CONNECTOR,
        { GIVEBUTTER_API_KEY: "gb_test_secret" },
        "manage",
        "contacts_store",
        { json: { apiKey: "must-not-pass" } },
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(requester).not.toHaveBeenCalled();
  });
});
