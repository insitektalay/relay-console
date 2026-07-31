import { lookup } from "node:dns/promises";
import {
  JellyfinApiAdapter,
  type JellyfinCredentials,
} from "./jellyfin-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: JellyfinCredentials = {
  serverBaseUrl: "https://jellyfin.example.test/media",
  apiKey: "0123456789abcdef0123456789abcdef",
  itemId: "f137a2dd21bbc1b99aa5c0f6bf02a805",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("JellyfinApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("uses one selected-item path and strips private metadata and content", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        Id: "f137a2dd21bbc1b99aa5c0f6bf02a805",
        Type: "Movie",
        DateCreated: "2026-07-18T01:02:03.0000000Z",
        Name: "Private title",
        Overview: "Private summary",
        Path: "/private/media.mkv",
        ProviderIds: { Imdb: "private" },
        UserData: { Played: true, IsFavorite: true },
        MediaSources: [{ Path: "/private/media.mkv" }],
        ImageTags: { Primary: "private" },
      }),
    );
    await expect(
      new JellyfinApiAdapter().getSelectedItemLifecycle(credentials),
    ).resolves.toEqual({
      item: {
        itemId: "f137a2dd21bbc1b99aa5c0f6bf02a805",
        type: "Movie",
        dateCreated: "2026-07-18T01:02:03.0000000Z",
        privateMediaMetadataIncluded: false,
        mediaContentIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://jellyfin.example.test/media/Items/f137a2dd21bbc1b99aa5c0f6bf02a805",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers.Authorization).toContain(
      'MediaBrowser Token="0123456789abcdef0123456789abcdef"',
    );
    expect(headers.Accept).toBe("application/json");
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://jellyfin.example.test",
    "https://user@jellyfin.example.test",
    "https://jellyfin.example.test/media?api_key=private",
    "https://jellyfin.example.test/media#private",
    "https://jellyfin.example.test/media/%2Fprivate",
  ])(
    "rejects an unsafe Jellyfin server base URL before network access: %s",
    async (serverBaseUrl) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new JellyfinApiAdapter().getSelectedItemLifecycle({
          ...credentials,
          serverBaseUrl,
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
      new JellyfinApiAdapter().getSelectedItemLifecycle(credentials),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe item IDs before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new JellyfinApiAdapter().getSelectedItemLifecycle({
        ...credentials,
        itemId: "../private",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a response for a different item", async () => {
    jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        Id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        Type: "Movie",
        DateCreated: "2026-07-18T01:02:03Z",
      }),
    );
    await expect(
      new JellyfinApiAdapter().getSelectedItemLifecycle(credentials),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });

  it("maps API-key failure without exposing provider response content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private" }, 401));
    await expect(
      new JellyfinApiAdapter().getSelectedItemLifecycle(credentials),
    ).rejects.toMatchObject({ code: "token_expired", statusCode: 401 });
  });
});
