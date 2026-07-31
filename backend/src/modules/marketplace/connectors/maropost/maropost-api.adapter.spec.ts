import {
  MaropostApiAdapter,
  type MaropostCredentials,
} from "./maropost-api.adapter";
import {
  MAROPOST_MANAGE_OPERATION_IDS,
  MAROPOST_OPERATIONS,
  MAROPOST_SENSITIVE_READ_OPERATION_IDS,
  MAROPOST_STRUCTURAL_READ_OPERATION_IDS,
} from "./maropost-operation-registry";

describe("MaropostApiAdapter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("pins the 5 selected operations and 1/2/2 policy split", () => {
    expect(MAROPOST_OPERATIONS).toHaveLength(5);
    expect(MAROPOST_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(1);
    expect(MAROPOST_SENSITIVE_READ_OPERATION_IDS).toHaveLength(2);
    expect(MAROPOST_MANAGE_OPERATION_IDS).toHaveLength(2);
  });

  it.each([
    [
      "3999",
      "https://api.maropost.com/v2/3999/campaigns.json?per_page=10&page=1",
    ],
    [
      "4500",
      "https://api-eu1.maropost.com/v2/4500/campaigns.json?per_page=10&page=1",
    ],
    [
      "5000",
      "https://api-ca1.maropost.com/v2/5000/campaigns.json?per_page=10&page=1",
    ],
  ])(
    "derives only the documented regional origin for account %s",
    async (accountId, expected) => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(new Response('{"campaigns":[]}'));
      await new MaropostApiAdapter().read(
        { accountId, apiKey: "customer-api-key" },
        "list_campaigns",
        { query: { per_page: 10, page: 1 } },
      );
      expect(String(fetchMock.mock.calls[0][0])).toBe(expected);
      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        method: "GET",
        redirect: "error",
        headers: expect.objectContaining({
          authorization: "ApiKey customer-api-key",
        }),
      });
    },
  );

  it("requires explicit authorization and subscription state for contact writes", async () => {
    const credentials: MaropostCredentials = {
      accountId: "11370",
      apiKey: "customer-api-key",
    };
    const input = {
      path: { listId: 17 },
      contact: { email: "person@example.com", subscribe: true },
    };
    await expect(
      new MaropostApiAdapter().manage(
        credentials,
        "upsert_contact_in_list",
        input,
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      new MaropostApiAdapter().manage(credentials, "upsert_contact_in_list", {
        ...input,
        consentAttestation: true,
        contact: { email: "person@example.com" },
      }),
    ).rejects.toThrow("explicit subscribe state");
  });

  it("blocks arbitrary operations, cross-policy use, credential input, and contact privilege escalation", async () => {
    const adapter = new MaropostApiAdapter();
    const credentials = { accountId: "11370", apiKey: "customer-api-key" };
    expect(() => adapter.manage(credentials, "send_campaign", {})).toThrow();
    expect(() =>
      adapter.read(credentials, "update_contact_in_list", {}),
    ).toThrow();
    await expect(
      adapter.read(credentials, "list_campaigns", {
        query: { auth_token: "agent-secret" },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "upsert_contact_in_list", {
        path: { listId: 17 },
        consentAttestation: true,
        contact: {
          email: "person@example.com",
          subscribe: true,
          remove_from_dnm: true,
        },
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
