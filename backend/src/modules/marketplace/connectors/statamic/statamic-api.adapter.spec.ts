import { lookup } from "node:dns/promises";
import {
  StatamicApiAdapter,
  type StatamicCredentials,
} from "./statamic-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: StatamicCredentials = {
  siteBaseUrl: "https://statamic.example.test/cms",
  apiToken: "S".repeat(32),
  collectionHandle: "articles",
  entryId: "f6d5a87",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("StatamicApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one exact entry and returns only its ID and status", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          id: "f6d5a87",
          status: "published",
          title: "Private title",
          content: "Private content",
          author: { email: "private@example.test" },
          api_url: "https://statamic.example.test/api/private",
        },
      }),
    );
    await expect(
      new StatamicApiAdapter().getSelectedEntryState(credentials),
    ).resolves.toEqual({
      entry: {
        entryId: "f6d5a87",
        status: "published",
        entryContentOrIdentityIncluded: false,
        otherSiteDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://statamic.example.test/cms/api/collections/articles/entries/f6d5a87?fields=id%2Cstatus",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${"S".repeat(32)}`,
        },
        redirect: "error",
      }),
    );
  });

  it.each([
    "http://statamic.example.test",
    "https://user@statamic.example.test",
    "https://statamic.example.test/cms?private=true",
    "https://statamic.example.test/cms#private",
    "https://statamic.example.test/cms/%2Fprivate",
  ])(
    "rejects an unsafe site URL before network access: %s",
    async (siteBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new StatamicApiAdapter().getSelectedEntryState({
          ...credentials,
          siteBaseUrl,
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
      new StatamicApiAdapter().getSelectedEntryState(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens and unsafe route identifiers", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new StatamicApiAdapter().getSelectedEntryState({
        ...credentials,
        apiToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new StatamicApiAdapter().getSelectedEntryState({
        ...credentials,
        collectionHandle: "../users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      new StatamicApiAdapter().getSelectedEntryState({
        ...credentials,
        entryId: "../other-entry",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a returned entry that differs from the configured selection", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        json({ data: { id: "other-entry", status: "published" } }),
      );
    await expect(
      new StatamicApiAdapter().getSelectedEntryState(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
