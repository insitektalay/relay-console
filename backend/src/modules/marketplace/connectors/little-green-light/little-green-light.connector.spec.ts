import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  LITTLE_GREEN_LIGHT_BOUNDED_REST_CONNECTOR,
  LITTLE_GREEN_LIGHT_MANAGE_OPERATION_IDS,
  LITTLE_GREEN_LIGHT_OPERATIONS,
  LITTLE_GREEN_LIGHT_READ_OPERATION_IDS,
} from "./little-green-light-operation-registry";

describe("Little Green Light connector", () => {
  it("pins the complete official dynamic REST contract", () => {
    expect(LITTLE_GREEN_LIGHT_OPERATIONS).toHaveLength(141);
    expect(LITTLE_GREEN_LIGHT_READ_OPERATION_IDS).toHaveLength(68);
    expect(LITTLE_GREEN_LIGHT_MANAGE_OPERATION_IDS).toHaveLength(73);
    expect(
      new Set(LITTLE_GREEN_LIGHT_OPERATIONS.map((item) => item.id)).size,
    ).toBe(141);
  });

  it("attaches the API key only to the fixed provider origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ item_type: "types" })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(LITTLE_GREEN_LIGHT_BOUNDED_REST_CONNECTOR, {
      LITTLE_GREEN_LIGHT_API_KEY: "example-provider-key",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://api.littlegreenlight.com/api/v1/types");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer example-provider-key",
    );
    expect(init.redirect).toBe("error");
  });

  it("rejects arbitrary operations", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.execute(
        LITTLE_GREEN_LIGHT_BOUNDED_REST_CONNECTOR,
        { LITTLE_GREEN_LIGHT_API_KEY: "example-provider-key" },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
