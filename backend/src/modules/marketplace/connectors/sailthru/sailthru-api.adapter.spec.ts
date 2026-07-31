import { createHash } from "node:crypto";
import {
  SailthruApiAdapter,
  type SailthruCredentials,
} from "./sailthru-api.adapter";
import {
  SAILTHRU_MANAGE_OPERATION_IDS,
  SAILTHRU_OPERATIONS,
  SAILTHRU_SENSITIVE_READ_OPERATION_IDS,
  SAILTHRU_STRUCTURAL_READ_OPERATION_IDS,
} from "./sailthru-operation-registry";

describe("SailthruApiAdapter", () => {
  const credentials: SailthruCredentials = {
    apiKey: "customer-key",
    apiSecret: "customer-secret",
    healthList: "Relay Staging",
  };
  afterEach(() => jest.restoreAllMocks());

  it("pins the 5 selected operations and 1/2/2 policy split", () => {
    expect(SAILTHRU_OPERATIONS).toHaveLength(5);
    expect(SAILTHRU_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(SAILTHRU_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
    expect(SAILTHRU_MANAGE_OPERATION_IDS).toHaveLength(2);
  });

  it("pins the API origin and generates the documented signature over exact JSON", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response('{"name":"Relay Staging"}'));
    await new SailthruApiAdapter().read(credentials, "get_list", {
      list: "Relay Staging",
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    const json = '{"list":"Relay Staging"}';
    expect(url.origin + url.pathname).toBe("https://api.sailthru.com/list");
    expect(url.searchParams.get("api_key")).toBe("customer-key");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("json")).toBe(json);
    expect(url.searchParams.get("sig")).toBe(
      createHash("md5")
        .update(`customer-secretcustomer-keyjson${json}`)
        .digest("hex"),
    );
  });

  it("requires authorization and double-opt-in evidence for preference escalation", async () => {
    const adapter = new SailthruApiAdapter();
    await expect(
      adapter.manage(credentials, "set_list_membership", {
        email: "person@example.com",
        list: "Newsletter",
        subscribed: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "set_list_membership", {
        email: "person@example.com",
        list: "Newsletter",
        subscribed: true,
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "set_email_optout", {
        email: "person@example.com",
        optoutEmail: "none",
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });

  it("blocks cross-policy, arbitrary operations, and credential input", async () => {
    const adapter = new SailthruApiAdapter();
    expect(() => adapter.read(credentials, "set_email_optout", {})).toThrow();
    expect(() => adapter.manage(credentials, "send", {})).toThrow();
    await expect(
      adapter.read(credentials, "get_user", {
        email: "person@example.com",
        apiSecret: "agent-secret",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
