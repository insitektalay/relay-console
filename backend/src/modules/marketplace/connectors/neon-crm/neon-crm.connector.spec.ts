import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  NEON_CRM_BOUNDED_REST_CONNECTOR,
  NEON_CRM_MANAGE_OPERATION_IDS,
  NEON_CRM_OPERATIONS,
  NEON_CRM_READ_OPERATION_IDS,
} from "./neon-crm-operation-registry";

describe("Neon CRM connector", () => {
  it("pins every operation from the official API v2.11 contract", () => {
    expect(NEON_CRM_OPERATIONS).toHaveLength(276);
    expect(NEON_CRM_READ_OPERATION_IDS).toHaveLength(129);
    expect(NEON_CRM_MANAGE_OPERATION_IDS).toHaveLength(147);
    expect(new Set(NEON_CRM_OPERATIONS.map((item) => item.id)).size).toBe(276);
  });

  it("builds Basic auth only for the fixed production API origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ id: "system-user-1" })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(NEON_CRM_BOUNDED_REST_CONNECTOR, {
      NEON_CRM_ORG_ID: "example-org",
      NEON_CRM_API_KEY: "example-provider-key",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://api.neoncrm.com/v2/properties/currentSystemUser",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("example-org:example-provider-key").toString("base64")}`,
    );
    expect(init.redirect).toBe("error");
  });

  it("treats documented POST searches as reads and rejects arbitrary routes", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ searchResults: [] })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      NEON_CRM_BOUNDED_REST_CONNECTOR,
      {
        NEON_CRM_ORG_ID: "example-org",
        NEON_CRM_API_KEY: "example-provider-key",
      },
      "read",
      "post_accounts_search",
      { json: { pagination: { currentPage: 0, pageSize: 20 } } },
    );
    const [searchUrl] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(searchUrl.pathname).toBe("/v2/accounts/search");
    await expect(
      adapter.execute(
        NEON_CRM_BOUNDED_REST_CONNECTOR,
        {
          NEON_CRM_ORG_ID: "example-org",
          NEON_CRM_API_KEY: "example-provider-key",
        },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
