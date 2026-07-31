import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR,
  VIRTUOUS_CRM_MANAGE_OPERATION_IDS,
  VIRTUOUS_CRM_OPERATIONS,
  VIRTUOUS_CRM_READ_OPERATION_IDS,
} from "./virtuous-crm-operation-registry";

describe("Virtuous CRM connector", () => {
  it("pins the current official API surface", () => {
    expect(VIRTUOUS_CRM_OPERATIONS).toHaveLength(275);
    expect(VIRTUOUS_CRM_READ_OPERATION_IDS).toHaveLength(165);
    expect(VIRTUOUS_CRM_MANAGE_OPERATION_IDS).toHaveLength(110);
    expect(
      VIRTUOUS_CRM_OPERATIONS.some((item) =>
        item.path.startsWith("/api/Reminder"),
      ),
    ).toBe(false);
  });

  it("attaches Bearer auth only to the fixed API origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ id: 123 })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR, {
      VIRTUOUS_CRM_API_KEY: "example-provider-key",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://api.virtuoussoftware.com/api/Organization/Current",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer example-provider-key",
    );
  });

  it("treats documented POST queries as semantic reads", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ list: [] })),
    );
    await new BoundedRestApiAdapter(requester).execute(
      VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR,
      { VIRTUOUS_CRM_API_KEY: "example-provider-key" },
      "read",
      "post_api_contact_query",
      { query: { skip: 0, take: 10 }, json: { groups: [] } },
    );
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it("rejects arbitrary operations", async () => {
    await expect(
      new BoundedRestApiAdapter(jest.fn()).execute(
        VIRTUOUS_CRM_BOUNDED_REST_CONNECTOR,
        { VIRTUOUS_CRM_API_KEY: "example-provider-key" },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
