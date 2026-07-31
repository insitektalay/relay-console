import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import { KINDFUL_CONNECTOR_MANIFEST } from "./kindful.connector";
import {
  KINDFUL_BOUNDED_REST_CONNECTOR,
  KINDFUL_OPERATIONS,
} from "./kindful-operation-registry";

describe("Kindful connector", () => {
  it("publishes the complete selected basic and data_query read surface", () => {
    expect(KINDFUL_OPERATIONS).toHaveLength(9);
    expect(KINDFUL_OPERATIONS.every((item) => !item.mutating)).toBe(true);
    expect(KINDFUL_CONNECTOR_MANIFEST.auth.oauth?.requiredScopes).toEqual([
      "basic",
      "data_query",
    ]);
    expect(KINDFUL_CONNECTOR_MANIFEST.tools).toHaveLength(1);
  });

  it("attaches OAuth only to the fixed Kindful origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ name: "Nonprofit" })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(KINDFUL_BOUNDED_REST_CONNECTOR, {
      accessToken: "provider-access-token",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://app.kindful.com/admin/oauth2/api/v1/details",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer provider-access-token",
    );
    expect(init.redirect).toBe("error");
  });

  it("allows documented POST queries but rejects arbitrary routes", async () => {
    const requester = jest.fn(
      async () =>
        new Response(JSON.stringify({ results: [], has_more: false })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      KINDFUL_BOUNDED_REST_CONNECTOR,
      { accessToken: "provider-access-token" },
      "read",
      "contacts_query",
      { json: { query: ["not_linked"], per_page: 25 } },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.pathname).toBe("/api/v1/contacts/query");
    expect(init.method).toBe("POST");
    await expect(
      adapter.execute(
        KINDFUL_BOUNDED_REST_CONNECTOR,
        { accessToken: "provider-access-token" },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
