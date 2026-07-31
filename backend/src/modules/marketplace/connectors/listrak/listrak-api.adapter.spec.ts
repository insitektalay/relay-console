import {
  ListrakApiAdapter,
  type ListrakCredentials,
} from "./listrak-api.adapter";
import {
  LISTRAK_MANAGE_OPERATION_IDS,
  LISTRAK_OPERATIONS,
  LISTRAK_SENSITIVE_READ_OPERATION_IDS,
  LISTRAK_STRUCTURAL_READ_OPERATION_IDS,
} from "./listrak-operation-registry";

describe("ListrakApiAdapter", () => {
  const credentials: ListrakCredentials = {
    clientId: "customer-client",
    clientSecret: "customer-secret",
  };
  afterEach(() => jest.restoreAllMocks());
  it("pins the 4 selected operations and 2/1/1 policy split", () => {
    expect(LISTRAK_OPERATIONS).toHaveLength(4);
    expect(LISTRAK_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(2);
    expect(LISTRAK_SENSITIVE_READ_OPERATION_IDS).toHaveLength(1);
    expect(LISTRAK_MANAGE_OPERATION_IDS).toHaveLength(1);
  });
  it("exchanges credentials only at the fixed token origin and calls Email v1", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"access_token":"ephemeral","expires_in":3600}'),
      )
      .mockResolvedValueOnce(new Response('{"status":200,"data":[]}'));
    await new ListrakApiAdapter().read(credentials, "list_lists", {});
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://auth.listrak.com/OAuth2/Token",
    );
    expect(
      new URLSearchParams(String(fetchMock.mock.calls[0][1]?.body)).get(
        "client_secret",
      ),
    ).toBe("customer-secret");
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://api.listrak.com/email/v1/List",
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "GET",
      headers: expect.objectContaining({ Authorization: "Bearer ephemeral" }),
    });
  });
  it("requires contact authorization and double-opt-in evidence", async () => {
    const adapter = new ListrakApiAdapter();
    await expect(
      adapter.manage(credentials, "upsert_contact", {
        listId: 1,
        email: "person@example.com",
        subscriptionState: "Subscribed",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "upsert_contact", {
        listId: 1,
        email: "person@example.com",
        subscriptionState: "Subscribed",
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("blocks cross-policy, arbitrary operations, and unsubscribe override input", async () => {
    const adapter = new ListrakApiAdapter();
    expect(() => adapter.read(credentials, "upsert_contact", {})).toThrow();
    expect(() => adapter.manage(credentials, "send_message", {})).toThrow();
    await expect(
      adapter.read(credentials, "get_contact", {
        listId: 1,
        email: "person@example.com",
        overrideUnsubscribe: true,
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
