import { lookup } from "node:dns/promises";
import {
  ConcreteCmsApiAdapter,
  type ConcreteCmsCredentials,
} from "./concrete-cms-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: ConcreteCmsCredentials = {
  siteBaseUrl: "https://cms.example.test/concrete",
  accessToken: "A".repeat(64),
  pageId: "42",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("ConcreteCmsApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("returns only selected-page lifecycle data", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: 42,
        date_added: "2026-07-01",
        date_last_updated: "2026-07-02",
        path: "/private-path",
        name: "Private page name",
        description: "Private description",
        content: { raw: "Private body" },
        custom_attributes: [{ key: "private", value: "secret" }],
      }),
    );
    await expect(
      new ConcreteCmsApiAdapter().getSelectedPageLifecycle(credentials),
    ).resolves.toEqual({
      page: {
        pageId: "42",
        dateAdded: "2026-07-01",
        dateLastUpdated: "2026-07-02",
        pageContentOrIdentityIncluded: false,
        otherSiteDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://cms.example.test/concrete/ccm/api/1.0/pages/42",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${"A".repeat(64)}`,
        },
        redirect: "error",
      }),
    );
  });

  it.each([
    "http://cms.example.test",
    "https://user@cms.example.test",
    "https://cms.example.test/concrete?api=private",
    "https://cms.example.test/concrete#private",
    "https://cms.example.test/concrete/%2Fprivate",
  ])(
    "rejects an unsafe site URL before network access: %s",
    async (siteBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new ConcreteCmsApiAdapter().getSelectedPageLifecycle({
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
      new ConcreteCmsApiAdapter().getSelectedPageLifecycle(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens and unsafe page IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new ConcreteCmsApiAdapter().getSelectedPageLifecycle({
        ...credentials,
        accessToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new ConcreteCmsApiAdapter().getSelectedPageLifecycle({
        ...credentials,
        pageId: "../users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response for a different page", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        id: 43,
        date_added: "2026-07-01",
        date_last_updated: "2026-07-02",
      }),
    );
    await expect(
      new ConcreteCmsApiAdapter().getSelectedPageLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
