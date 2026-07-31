import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  EVERYACTION_BOUNDED_REST_CONNECTOR,
  EVERYACTION_MANAGE_OPERATION_IDS,
  EVERYACTION_OPERATIONS,
  EVERYACTION_READ_OPERATION_IDS,
} from "./everyaction-operation-registry";

describe("EveryAction connector", () => {
  it("pins the current official non-payment API surface", () => {
    expect(EVERYACTION_OPERATIONS).toHaveLength(217);
    expect(EVERYACTION_READ_OPERATION_IDS).toHaveLength(123);
    expect(EVERYACTION_MANAGE_OPERATION_IDS).toHaveLength(94);
    expect(
      EVERYACTION_OPERATIONS.some(
        (item) => String(item.path) === "/contributions/payments",
      ),
    ).toBe(false);
  });

  it("attaches Basic auth only to the fixed API origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ items: [] })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(EVERYACTION_BOUNDED_REST_CONNECTOR, {
      EVERYACTION_APPLICATION_NAME: "relayIntegration",
      EVERYACTION_API_KEY: "00000000-0000-0000-0000-000000000000|1",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe(
      "https://api.securevan.com/v4/canvassResponses/contactTypes",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("relayIntegration:00000000-0000-0000-0000-000000000000|1").toString("base64")}`,
    );
  });

  it("keeps non-GET operations in the mutation mode", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ vanId: 123 })),
    );
    await new BoundedRestApiAdapter(requester).execute(
      EVERYACTION_BOUNDED_REST_CONNECTOR,
      {
        EVERYACTION_APPLICATION_NAME: "relayIntegration",
        EVERYACTION_API_KEY: "00000000-0000-0000-0000-000000000000|1",
      },
      "manage",
      "post_people_find",
      { json: { firstName: "Ada", lastName: "Lovelace" } },
    );
    expect(requester).toHaveBeenCalledTimes(1);
  });

  it("rejects arbitrary operations", async () => {
    await expect(
      new BoundedRestApiAdapter(jest.fn()).execute(
        EVERYACTION_BOUNDED_REST_CONNECTOR,
        {
          EVERYACTION_APPLICATION_NAME: "relayIntegration",
          EVERYACTION_API_KEY: "00000000-0000-0000-0000-000000000000|1",
        },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
