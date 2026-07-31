import {
  DotdigitalApiAdapter,
  type DotdigitalCredentials,
} from "./dotdigital-api.adapter";
import {
  DOTDIGITAL_MANAGE_OPERATION_IDS,
  DOTDIGITAL_OPERATIONS,
  DOTDIGITAL_SENSITIVE_READ_OPERATION_IDS,
  DOTDIGITAL_STRUCTURAL_READ_OPERATION_IDS,
} from "./dotdigital-operation-registry";

describe("DotdigitalApiAdapter", () => {
  const credentials: DotdigitalCredentials = {
    username: "api-user@example.com",
    password: "customer-password",
  };
  afterEach(() => jest.restoreAllMocks());
  it("pins the 4 selected operations and 2/1/1 policy split", () => {
    expect(DOTDIGITAL_OPERATIONS).toHaveLength(4);
    expect(DOTDIGITAL_STRUCTURAL_READ_OPERATION_IDS).toHaveLength(2);
    expect(DOTDIGITAL_SENSITIVE_READ_OPERATION_IDS).toHaveLength(1);
    expect(DOTDIGITAL_MANAGE_OPERATION_IDS).toHaveLength(1);
  });
  it("discovers and allowlists the regional origin before a bounded read", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"ApiEndpoint":"https://r2-api.dotdigital.com/"}'),
      )
      .mockResolvedValueOnce(new Response("[]"));
    await new DotdigitalApiAdapter().read(credentials, "list_address_books", {
      select: 10,
      skip: 20,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://r1-api.dotdigital.com/v2/account-info",
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: expect.stringMatching(/^Basic /),
      }),
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      "https://r2-api.dotdigital.com/v2/address-books?select=10&skip=20",
    );
  });
  it("rejects an endpoint outside the exact regional allowlist", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response('{"ApiEndpoint":"https://attacker.example/"}'),
      );
    await expect(
      new DotdigitalApiAdapter().read(credentials, "list_address_books", {}),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("requires contact authorization and double-opt-in evidence", async () => {
    const adapter = new DotdigitalApiAdapter();
    await expect(
      adapter.manage(credentials, "update_contact_by_email", {
        email: "person@example.com",
        emailStatus: "subscribed",
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    await expect(
      adapter.manage(credentials, "update_contact_by_email", {
        email: "person@example.com",
        emailStatus: "subscribed",
        consentAttestation: true,
      }),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
  it("blocks cross-policy, arbitrary operations, and routing input", async () => {
    const adapter = new DotdigitalApiAdapter();
    expect(() =>
      adapter.read(credentials, "update_contact_by_email", {}),
    ).toThrow();
    expect(() => adapter.manage(credentials, "send_campaign", {})).toThrow();
    await expect(
      adapter.read(credentials, "get_contact_by_email", {
        email: "person@example.com",
        endpoint: "https://attacker.example",
      } as never),
    ).rejects.toMatchObject({ code: "policy_blocked" });
  });
});
