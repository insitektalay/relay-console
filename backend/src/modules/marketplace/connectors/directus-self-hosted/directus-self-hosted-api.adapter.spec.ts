import { lookup } from "node:dns/promises";
import {
  DirectusSelfHostedApiAdapter,
  type DirectusSelfHostedCredentials,
} from "./directus-self-hosted-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: DirectusSelfHostedCredentials = {
  instanceBaseUrl: "https://directus.example.test/platform",
  staticToken: "D".repeat(32),
  collection: "relay_status",
  itemKey: "42",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("DirectusSelfHostedApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one exact item and returns only its ID and status", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          id: 42,
          status: "published",
          title: "Private title",
          body: "Private content",
          owner: { email: "private@example.test" },
        },
      }),
    );
    await expect(
      new DirectusSelfHostedApiAdapter().getSelectedItemState(credentials),
    ).resolves.toEqual({
      item: {
        itemId: "42",
        status: "published",
        itemContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://directus.example.test/platform/items/relay_status/42?fields=id%2Cstatus",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${"D".repeat(32)}`,
        },
        redirect: "error",
      }),
    );
  });

  it.each([
    "http://directus.example.test",
    "https://user@directus.example.test",
    "https://directus.example.test/platform?private=true",
    "https://directus.example.test/platform#private",
    "https://directus.example.test/platform/%2Fprivate",
  ])(
    "rejects an unsafe instance URL before network access: %s",
    async (instanceBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new DirectusSelfHostedApiAdapter().getSelectedItemState({
          ...credentials,
          instanceBaseUrl,
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
      new DirectusSelfHostedApiAdapter().getSelectedItemState(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens and unsafe route identifiers", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new DirectusSelfHostedApiAdapter().getSelectedItemState({
        ...credentials,
        staticToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new DirectusSelfHostedApiAdapter().getSelectedItemState({
        ...credentials,
        collection: "../directus_users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      new DirectusSelfHostedApiAdapter().getSelectedItemState({
        ...credentials,
        itemKey: "../other-item",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a returned item that differs from the configured selection", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ data: { id: 43, status: "published" } }),
      );
    await expect(
      new DirectusSelfHostedApiAdapter().getSelectedItemState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
