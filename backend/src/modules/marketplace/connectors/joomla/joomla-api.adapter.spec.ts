import { lookup } from "node:dns/promises";
import { JoomlaApiAdapter, type JoomlaCredentials } from "./joomla-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: JoomlaCredentials = {
  siteBaseUrl: "https://cms.example.test/joomla",
  apiToken: "A".repeat(64),
  articleId: "42",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("JoomlaApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one selected article and returns only lifecycle data", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          type: "articles",
          id: "42",
          attributes: {
            id: 42,
            state: 1,
            created: "2026-07-01 10:00:00",
            modified: "2026-07-02 11:00:00",
            title: "Private title",
            text: "Private article body",
            created_by: 99,
            metadata: { private: true },
          },
        },
      }),
    );
    await expect(
      new JoomlaApiAdapter().getSelectedArticleLifecycle(credentials),
    ).resolves.toEqual({
      article: {
        articleId: "42",
        state: 1,
        published: true,
        createdAt: "2026-07-01 10:00:00",
        modifiedAt: "2026-07-02 11:00:00",
        articleContentOrIdentityIncluded: false,
        otherSiteDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://cms.example.test/joomla/api/index.php/v1/content/articles/42",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "GET",
        headers: {
          Accept: "application/vnd.api+json",
          "X-Joomla-Token": "A".repeat(64),
        },
        redirect: "error",
      }),
    );
  });

  it.each([
    "http://cms.example.test",
    "https://user@cms.example.test",
    "https://cms.example.test/joomla?api=private",
    "https://cms.example.test/joomla#private",
    "https://cms.example.test/joomla/%2Fprivate",
  ])(
    "rejects an unsafe site URL before network access: %s",
    async (siteBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new JoomlaApiAdapter().getSelectedArticleLifecycle({
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
      new JoomlaApiAdapter().getSelectedArticleLifecycle(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens and unsafe article IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new JoomlaApiAdapter().getSelectedArticleLifecycle({
        ...credentials,
        apiToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new JoomlaApiAdapter().getSelectedArticleLifecycle({
        ...credentials,
        articleId: "../users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response for a different article", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          type: "articles",
          id: "43",
          attributes: {
            state: 1,
            created: "2026-07-01 10:00:00",
            modified: null,
          },
        },
      }),
    );
    await expect(
      new JoomlaApiAdapter().getSelectedArticleLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
