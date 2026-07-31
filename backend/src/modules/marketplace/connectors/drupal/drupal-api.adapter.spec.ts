import { lookup } from "node:dns/promises";
import { DrupalApiAdapter, type DrupalCredentials } from "./drupal-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: DrupalCredentials = {
  siteBaseUrl: "https://cms.example.test/community",
  nodeBundle: "article",
  nodeUuid: "9f6e36e7-47d1-4dd0-b14c-2868d7248f02",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("DrupalApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("reads one selected public node lifecycle and strips content and relationships", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          type: "node--article",
          id: "9f6e36e7-47d1-4dd0-b14c-2868d7248f02",
          attributes: {
            status: true,
            created: "2026-07-01T09:00:00+00:00",
            changed: "2026-07-17T18:30:00+00:00",
            title: "Private editorial title",
            body: { value: "Private body" },
          },
          relationships: { uid: { data: { type: "user--user" } } },
        },
      }),
    );
    await expect(
      new DrupalApiAdapter().getSelectedNodeLifecycle(credentials),
    ).resolves.toEqual({
      node: {
        uuid: "9f6e36e7-47d1-4dd0-b14c-2868d7248f02",
        resourceType: "node--article",
        published: true,
        createdAt: "2026-07-01T09:00:00+00:00",
        changedAt: "2026-07-17T18:30:00+00:00",
        contentAuthorAndRelationshipsIncluded: false,
        authenticatedOrMutableAccessIncluded: false,
      },
    });
    const url = new URL(fetchMock.mock.calls[0][0].toString());
    expect(url.origin + url.pathname).toBe(
      "https://cms.example.test/community/jsonapi/node/article/9f6e36e7-47d1-4dd0-b14c-2868d7248f02",
    );
    expect(url.searchParams.get("fields[node--article]")).toBe(
      "status,created,changed",
    );
    expect([...url.searchParams.keys()]).toEqual(["fields[node--article]"]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "GET",
      headers: { Accept: "application/vnd.api+json" },
      redirect: "error",
    });
  });

  it.each([
    "http://cms.example.test",
    "https://user@cms.example.test",
    "https://cms.example.test/community?filter=private",
    "https://cms.example.test/community#private",
    "https://cms.example.test/community/%2Fprivate",
  ])(
    "rejects an unsafe base URL before network access: %s",
    async (siteBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new DrupalApiAdapter().getSelectedNodeLifecycle({
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
      new DrupalApiAdapter().getSelectedNodeLifecycle(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { nodeBundle: "Article" },
    { nodeBundle: "../user" },
    { nodeUuid: "not-a-uuid" },
    { nodeUuid: "9F6E36E7-47D1-4DD0-B14C-2868D7248F02" },
  ])("rejects an unsafe selected-node boundary: %p", async (boundary) => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new DrupalApiAdapter().getSelectedNodeLifecycle({
        ...credentials,
        ...boundary,
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a different resource and included relationships", async () => {
    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      json({
        data: {
          type: "node--page",
          id: "9f6e36e7-47d1-4dd0-b14c-2868d7248f02",
          attributes: {
            status: true,
            created: "2026-07-01T09:00:00Z",
            changed: "2026-07-17T18:30:00Z",
          },
        },
      }),
    );
    await expect(
      new DrupalApiAdapter().getSelectedNodeLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });

    jest.spyOn(global, "fetch").mockImplementationOnce(() =>
      json({
        data: {
          type: "node--article",
          id: "9f6e36e7-47d1-4dd0-b14c-2868d7248f02",
          attributes: {
            status: true,
            created: "2026-07-01T09:00:00Z",
            changed: "2026-07-17T18:30:00Z",
          },
        },
        included: [{ type: "user--user", id: "private" }],
      }),
    );
    await expect(
      new DrupalApiAdapter().getSelectedNodeLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
