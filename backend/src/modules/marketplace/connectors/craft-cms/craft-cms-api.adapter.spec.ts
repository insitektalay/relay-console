import { lookup } from "node:dns/promises";
import {
  CraftCmsApiAdapter,
  type CraftCmsCredentials,
} from "./craft-cms-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const entryUid = "10a4c2a2-87f8-4d6a-8f44-842168ab672a";
const credentials: CraftCmsCredentials = {
  siteBaseUrl: "https://craft.example.test/cms",
  graphqlToken: "A".repeat(32),
  entryUid,
};

function json(value: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(value), { status }));
}

describe("CraftCmsApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("uses one fixed query and returns only selected-entry lifecycle data", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        data: {
          entries: [
            {
              uid: entryUid,
              status: "live",
              dateCreated: "2026-07-01T10:00:00+00:00",
              dateUpdated: "2026-07-02T11:00:00+00:00",
              title: "Private title",
              uri: "private/path",
              author: { email: "private@example.test" },
              privateBody: "Private content",
            },
          ],
        },
      }),
    );
    await expect(
      new CraftCmsApiAdapter().getSelectedEntryLifecycle(credentials),
    ).resolves.toEqual({
      entry: {
        entryUid,
        status: "live",
        dateCreated: "2026-07-01T10:00:00+00:00",
        dateUpdated: "2026-07-02T11:00:00+00:00",
        entryContentOrIdentityIncluded: false,
        otherProjectDataIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://craft.example.test/cms/actions/graphql/api",
    );
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${"A".repeat(32)}`,
          "Content-Type": "application/json",
        },
        redirect: "error",
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({
      query: expect.stringContaining("entries(uid: $uid, limit: 1)"),
      variables: { uid: [entryUid] },
    });
    expect(body.query).not.toMatch(/mutation|title|author|uri/i);
  });

  it.each([
    "http://craft.example.test",
    "https://user@craft.example.test",
    "https://craft.example.test/cms?private=true",
    "https://craft.example.test/cms#private",
    "https://craft.example.test/cms/%2Fprivate",
  ])(
    "rejects an unsafe site URL before network access: %s",
    async (siteBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new CraftCmsApiAdapter().getSelectedEntryLifecycle({
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
      new CraftCmsApiAdapter().getSelectedEntryLifecycle(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid tokens and unsafe entry UUIDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new CraftCmsApiAdapter().getSelectedEntryLifecycle({
        ...credentials,
        graphqlToken: "short",
      }),
    ).rejects.toMatchObject({ code: "credential_missing" });
    await expect(
      new CraftCmsApiAdapter().getSelectedEntryLifecycle({
        ...credentials,
        entryUid: "../users",
      }),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects GraphQL errors and a different entry", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementationOnce(() => json({ errors: [{ message: "denied" }] }))
      .mockImplementationOnce(() =>
        json({
          data: {
            entries: [
              {
                uid: "aaaa1111-2222-4333-8444-555555555555",
                status: "live",
                dateCreated: "2026-07-01T10:00:00+00:00",
                dateUpdated: "2026-07-02T11:00:00+00:00",
              },
            ],
          },
        }),
      );
    const adapter = new CraftCmsApiAdapter();
    await expect(
      adapter.getSelectedEntryLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
    await expect(
      adapter.getSelectedEntryLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
