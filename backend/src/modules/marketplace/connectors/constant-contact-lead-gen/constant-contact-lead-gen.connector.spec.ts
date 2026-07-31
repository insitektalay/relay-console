import { BoundedRestApiAdapter } from "../bounded-rest/bounded-rest-api.adapter";
import {
  CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
  CONSTANT_CONTACT_LEAD_GEN_MANAGE_OPERATION_IDS,
  CONSTANT_CONTACT_LEAD_GEN_OPERATIONS,
  CONSTANT_CONTACT_LEAD_GEN_READ_OPERATION_IDS,
} from "./constant-contact-lead-gen-operation-registry";

const credentials = {
  CONSTANT_CONTACT_LEAD_GEN_ACCOUNT_ID: "account-123",
  CONSTANT_CONTACT_LEAD_GEN_SECRET_KEY: "example-secret",
};

describe("Constant Contact Lead Gen & CRM connector", () => {
  it("pins every current documented Open API method without duplicates", () => {
    expect(CONSTANT_CONTACT_LEAD_GEN_OPERATIONS).toHaveLength(115);
    expect(CONSTANT_CONTACT_LEAD_GEN_READ_OPERATION_IDS).toHaveLength(52);
    expect(CONSTANT_CONTACT_LEAD_GEN_MANAGE_OPERATION_IDS).toHaveLength(63);
    expect(
      new Set(CONSTANT_CONTACT_LEAD_GEN_OPERATIONS.map((item) => item.id)).size,
    ).toBe(115);
  });

  it("uses the fixed v1.2 UTC endpoint, header credentials and bound health method", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ result: [] })),
    );
    await new BoundedRestApiAdapter(requester).health(
      CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
      credentials,
    );
    const [url, init] = requester.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(url.href).toBe("https://api.sharpspring.com/pubapi/v1.2/");
    expect((init.headers as Record<string, string>)["X-Account-Id"]).toBe(
      "account-123",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer example-secret",
    );
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body))).toMatchObject({
      method: "getUserProfiles",
      params: {},
    });
    expect(JSON.parse(String(init.body)).id).toEqual(expect.any(String));
  });

  it("keeps the selected method outside caller-controlled params", async () => {
    const requester = jest.fn(
      async () => new Response(JSON.stringify({ result: [] })),
    );
    await new BoundedRestApiAdapter(requester).execute(
      CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
      credentials,
      "read",
      "getLead",
      { json: { id: 42, method: "deleteLeads" } },
    );
    const calls = requester.mock.calls as unknown as [URL, RequestInit][];
    const body = JSON.parse(String(calls[0][1].body));
    expect(body.method).toBe("getLead");
    expect(body.params).toEqual({ id: 42, method: "deleteLeads" });
  });

  it("rejects arbitrary methods, wrong classes and more than 500 objects", async () => {
    const adapter = new BoundedRestApiAdapter(jest.fn());
    await expect(
      adapter.execute(
        CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "rawRequest",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
        credentials,
        "read",
        "createSendMail",
        {},
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.execute(
        CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
        credentials,
        "manage",
        "createLeads",
        { json: { objects: Array.from({ length: 501 }, () => ({})) } },
      ),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("fails closed on an HTTP-success RPC error envelope", async () => {
    const adapter = new BoundedRestApiAdapter(
      jest.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { message: "Invalid account binding" } }),
          ),
      ),
    );
    await expect(
      adapter.health(
        CONSTANT_CONTACT_LEAD_GEN_BOUNDED_REST_CONNECTOR,
        credentials,
      ),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      message: "Invalid account binding",
    });
  });
});
