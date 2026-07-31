import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import { NATIONBUILDER_CONNECTOR_MANIFEST } from "./nationbuilder.connector";
import {
  NATIONBUILDER_BOUNDED_REST_CONNECTOR,
  NATIONBUILDER_MANAGE_OPERATION_IDS,
  NATIONBUILDER_OPERATIONS,
  NATIONBUILDER_READ_OPERATION_IDS,
} from "./nationbuilder-operation-registry";

describe("NationBuilder connector", () => {
  it("pins the complete current official V2 API surface", () => {
    expect(NATIONBUILDER_OPERATIONS).toHaveLength(190);
    expect(NATIONBUILDER_READ_OPERATION_IDS).toHaveLength(82);
    expect(NATIONBUILDER_MANAGE_OPERATION_IDS).toHaveLength(108);
    expect(NATIONBUILDER_CONNECTOR_MANIFEST.auth.oauth).toMatchObject({
      requiredScopes: ["default"],
      pkce: true,
      supportsRefresh: true,
    });
  });

  it("binds OAuth to one validated nation subdomain", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ data: { id: "123" } })),
    );
    await new BoundedRestApiAdapter(requester).health(
      NATIONBUILDER_BOUNDED_REST_CONNECTOR,
      {
        accessToken: "provider-access-token",
        nationBuilderNationSlug: "relay-demo",
      },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://relay-demo.nationbuilder.com/api/v2/signups/me",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer provider-access-token",
    );
  });

  it("rejects invalid nation hosts and arbitrary operations", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.health(NATIONBUILDER_BOUNDED_REST_CONNECTOR, {
        accessToken: "provider-access-token",
        nationBuilderNationSlug: "relay-demo.evil.example",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        NATIONBUILDER_BOUNDED_REST_CONNECTOR,
        {
          accessToken: "provider-access-token",
          nationBuilderNationSlug: "relay-demo",
        },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
