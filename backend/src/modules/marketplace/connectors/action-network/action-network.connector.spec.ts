import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
  ACTION_NETWORK_MANAGE_OPERATION_IDS,
  ACTION_NETWORK_OPERATIONS,
  ACTION_NETWORK_READ_OPERATION_IDS,
  ACTION_NETWORK_SENSITIVE_READ_OPERATION_IDS,
  ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS,
} from "./action-network-operation-registry";

const credentials = { ACTION_NETWORK_API_KEY: "example-partner-key" };

describe("Action Network connector", () => {
  it("pins every documented v2 operation without duplicates", () => {
    expect(ACTION_NETWORK_OPERATIONS).toHaveLength(104);
    expect(ACTION_NETWORK_READ_OPERATION_IDS).toHaveLength(64);
    expect(ACTION_NETWORK_SYSTEM_READ_OPERATION_IDS).toHaveLength(3);
    expect(ACTION_NETWORK_SENSITIVE_READ_OPERATION_IDS).toHaveLength(61);
    expect(ACTION_NETWORK_MANAGE_OPERATION_IDS).toHaveLength(40);
    expect(new Set(ACTION_NETWORK_OPERATIONS.map((item) => item.id)).size).toBe(
      104,
    );
  });

  it("uses the fixed v2 origin and OSDI token header", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ osdi_version: "1.1.1" })),
    );
    await new BoundedRestApiAdapter(requester).health(
      ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
      credentials,
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://actionnetwork.org/api/v2/");
    expect((init.headers as Record<string, string>)["OSDI-API-Token"]).toBe(
      "example-partner-key",
    );
    expect(init.redirect).toBe("error");
  });

  it("builds exact nested activist and message routes", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ identifiers: [] })),
    );
    const adapter = new BoundedRestApiAdapter(requester);
    await adapter.execute(
      ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
      credentials,
      "read",
      "get_signature",
      {
        pathParameters: {
          petition_id: "petition-1",
          resource_id: "signature-2",
        },
      },
    );
    await adapter.execute(
      ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
      credentials,
      "manage",
      "send_message",
      {
        pathParameters: { message_id: "message-3" },
        json: {},
      },
    );
    const calls = requester.mock.calls as unknown as [URL, RequestInit][];
    expect(calls[0][0].href).toBe(
      "https://actionnetwork.org/api/v2/petitions/petition-1/signatures/signature-2",
    );
    expect(calls[1][0].href).toBe(
      "https://actionnetwork.org/api/v2/messages/message-3/send",
    );
  });

  it("rejects raw routes, wrong operation classes and path overrides", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.execute(
        ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "raw_request",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "send_message",
        { pathParameters: { message_id: "message-3" } },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        ACTION_NETWORK_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "get_person",
        { pathParameters: { person_id: "person-1", group_id: "other" } },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
