import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import { GIVE_LIVELY_CONNECTOR_MANIFEST } from "./give-lively.connector";
import {
  GIVE_LIVELY_BOUNDED_REST_CONNECTOR,
  GIVE_LIVELY_OPERATIONS,
} from "./give-lively-operation-registry";

describe("Give Lively connector", () => {
  it("publishes exactly the two official read-only JSON endpoints", () => {
    expect(GIVE_LIVELY_OPERATIONS).toHaveLength(2);
    expect(GIVE_LIVELY_OPERATIONS.every((item) => !item.mutating)).toBe(true);
    expect(GIVE_LIVELY_CONNECTOR_MANIFEST.tools).toHaveLength(1);
    expect(
      GIVE_LIVELY_CONNECTOR_MANIFEST.approvalProfiles[0]
        .approvalRequiredActions,
    ).toEqual([]);
  });

  it("constructs the secret-bearing path only inside the fixed provider adapter", async () => {
    const requester = jest.fn(
      async () =>
        new Response(JSON.stringify([{ id: "donation-1" }]), { status: 200 }),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      GIVE_LIVELY_BOUNDED_REST_CONNECTOR,
      {
        GIVE_LIVELY_ORGANIZATION_ID: "org-123",
        GIVE_LIVELY_API_KEY: "example-provider-key",
      },
      "read",
      "donations_index",
      { query: { start_time_ms: 1_700_000_000_000 } },
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.origin).toBe("https://secure.givelively.org");
    expect(url.pathname).toBe(
      "/nonprofits/org-123/json_dataclips/example-provider-key.json",
    );
    expect(url.searchParams.get("start_time_ms")).toBe("1700000000000");
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    expect(init.redirect).toBe("error");
  });

  it("requires both stored credentials and rejects arbitrary operations", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.health(GIVE_LIVELY_BOUNDED_REST_CONNECTOR, {
        GIVE_LIVELY_ORGANIZATION_ID: "org-123",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      adapter.execute(
        GIVE_LIVELY_BOUNDED_REST_CONNECTOR,
        {
          GIVE_LIVELY_ORGANIZATION_ID: "org-123",
          GIVE_LIVELY_API_KEY: "example-provider-key",
        },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
