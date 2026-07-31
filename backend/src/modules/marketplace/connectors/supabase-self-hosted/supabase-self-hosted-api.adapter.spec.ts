import { lookup } from "node:dns/promises";
import {
  SupabaseSelfHostedApiAdapter,
  type SupabaseSelfHostedCredentials,
} from "./supabase-self-hosted-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const publishableKey = `sb_publishable_${"a".repeat(22)}_${"b".repeat(8)}`;
const credentials: SupabaseSelfHostedCredentials = {
  projectBaseUrl: "https://supabase.example.test/gateway",
  publishableKey,
  table: "relay_status",
  rowId: "7a8b9c",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("SupabaseSelfHostedApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one exact row and returns only its ID and status", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json([
        {
          id: "7a8b9c",
          status: "ready",
          customer_email: "private@example.test",
          payload: "Private data",
        },
      ]),
    );
    await expect(
      new SupabaseSelfHostedApiAdapter().getSelectedRowState(credentials),
    ).resolves.toEqual({
      row: {
        rowId: "7a8b9c",
        status: "ready",
        rowContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://supabase.example.test/gateway/rest/v1/relay_status?select=id%2Cstatus&id=eq.7a8b9c&limit=1",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
        redirect: "error",
      }),
    );
  });

  it.each([
    "http://supabase.example.test",
    "https://user@supabase.example.test",
    "https://supabase.example.test/gateway?private=true",
    "https://supabase.example.test/gateway#private",
    "https://supabase.example.test/gateway/%2Fprivate",
  ])(
    "rejects an unsafe project URL before network access: %s",
    async (projectBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new SupabaseSelfHostedApiAdapter().getSelectedRowState({
          ...credentials,
          projectBaseUrl,
        }),
      ).rejects.toMatchObject({ code: "policy_blocked" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects private DNS resolution before network access", async () => {
    mockedLookup.mockResolvedValue([
      { address: "192.168.1.10", family: 4 },
    ] as never);
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new SupabaseSelfHostedApiAdapter().getSelectedRowState(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects secret, legacy, and malformed keys and unsafe identifiers", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    for (const publishableKey of [
      `sb_secret_${"a".repeat(22)}_${"b".repeat(8)}`,
      "eyJhbGciOiJIUzI1NiJ9.service-role.signature",
      "short",
    ]) {
      await expect(
        new SupabaseSelfHostedApiAdapter().getSelectedRowState({
          ...credentials,
          publishableKey,
        }),
      ).rejects.toMatchObject({ code: "credential_missing" });
    }
    await expect(
      new SupabaseSelfHostedApiAdapter().getSelectedRowState({
        ...credentials,
        table: "../auth_users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      new SupabaseSelfHostedApiAdapter().getSelectedRowState({
        ...credentials,
        rowId: "../other-row",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects missing, duplicate, or mismatched rows", async () => {
    const adapter = new SupabaseSelfHostedApiAdapter();
    jest.spyOn(global, "fetch").mockImplementationOnce(() => json([]));
    await expect(
      adapter.getSelectedRowState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      json([
        { id: "7a8b9c", status: "ready" },
        { id: "other", status: "ready" },
      ]),
    );
    await expect(
      adapter.getSelectedRowState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() => json([{ id: "other", status: "ready" }]));
    await expect(
      adapter.getSelectedRowState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
