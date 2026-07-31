import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  DONATELY_BOUNDED_REST_CONNECTOR,
  DONATELY_MANAGE_OPERATION_IDS,
  DONATELY_OPERATIONS,
  DONATELY_READ_OPERATION_IDS,
} from "./donately-operation-registry";

describe("Donately connector", () => {
  it("pins the complete current API v2 reference", () => {
    expect(DONATELY_OPERATIONS).toHaveLength(38);
    expect(DONATELY_READ_OPERATION_IDS).toHaveLength(20);
    expect(DONATELY_MANAGE_OPERATION_IDS).toHaveLength(18);
  });

  it("binds version, account and Basic token to the fixed origin", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ id: "act_example" })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.health(DONATELY_BOUNDED_REST_CONNECTOR, {
      DONATELY_ACCOUNT_ID: "act_example",
      DONATELY_API_TOKEN: "example-provider-token",
    });
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://api.donately.com/v2/accounts/mine");
    expect((init.headers as Record<string, string>)["Donately-Version"]).toBe(
      "2022-12-15",
    );
    expect((init.headers as Record<string, string>)["Donately-Account"]).toBe(
      "act_example",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("example-provider-token:").toString("base64")}`,
    );
  });

  it("rejects arbitrary operations", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.execute(
        DONATELY_BOUNDED_REST_CONNECTOR,
        {
          DONATELY_ACCOUNT_ID: "act_example",
          DONATELY_API_TOKEN: "example-provider-token",
        },
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
