import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  FUNDRAISE_UP_BOUNDED_REST_CONNECTOR,
  FUNDRAISE_UP_MANAGE_OPERATION_IDS,
  FUNDRAISE_UP_OPERATIONS,
  FUNDRAISE_UP_READ_OPERATION_IDS,
} from "./fundraise-up-operation-registry";

describe("Fundraise Up connector", () => {
  it("pins the complete official OpenAPI surface", () => {
    expect(FUNDRAISE_UP_OPERATIONS).toHaveLength(35);
    expect(FUNDRAISE_UP_READ_OPERATION_IDS).toHaveLength(18);
    expect(FUNDRAISE_UP_MANAGE_OPERATION_IDS).toHaveLength(17);
  });
  it("attaches Bearer auth only to the fixed API origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ data: [] })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(FUNDRAISE_UP_BOUNDED_REST_CONNECTOR, {
      FUNDRAISE_UP_API_KEY: "example-provider-key",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://api.fundraiseup.com/v1/campaigns?livemode=false&limit=1",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer example-provider-key",
    );
  });
  it("rejects arbitrary operations", async () => {
    await expect(
      new BoundedRestApiAdapter(jest.fn()).execute(
        FUNDRAISE_UP_BOUNDED_REST_CONNECTOR,
        { FUNDRAISE_UP_API_KEY: "example-provider-key" },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
