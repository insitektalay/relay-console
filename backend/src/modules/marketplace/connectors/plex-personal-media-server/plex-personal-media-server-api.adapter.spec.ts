import { lookup } from "node:dns/promises";
import {
  PlexPersonalMediaServerApiAdapter,
  type PlexPersonalMediaServerCredentials,
} from "./plex-personal-media-server-api.adapter";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));
const mockedLookup = lookup as jest.MockedFunction<typeof lookup>;

const credentials: PlexPersonalMediaServerCredentials = {
  serverOrigin: "https://203-0-114-10.abc123def456.plex.direct:32400",
  token: "test-plex-token",
  ratingKey: "1049",
};

function json(value: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("PlexPersonalMediaServerApiAdapter", () => {
  beforeEach(() =>
    mockedLookup.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
    ] as never),
  );
  afterEach(() => jest.restoreAllMocks());

  it("uses one selected-item path and strips private metadata and content", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(() =>
      json({
        MediaContainer: {
          size: 1,
          librarySectionTitle: "Private library",
          librarySectionUUID: "private",
          Metadata: [
            {
              ratingKey: "1049",
              type: "movie",
              addedAt: 1408525217,
              updatedAt: 1434341184,
              title: "Private title",
              summary: "Private summary",
              guid: "private",
              thumb: "/private",
              art: "/private",
              Media: [{ Part: [{ file: "/private/media.mkv" }] }],
              UserRating: [{ private: "private" }],
            },
          ],
        },
      }),
    );
    await expect(
      new PlexPersonalMediaServerApiAdapter().getSelectedItemLifecycle(
        credentials,
      ),
    ).resolves.toEqual({
      item: {
        ratingKey: "1049",
        type: "movie",
        addedAt: 1408525217,
        updatedAt: 1434341184,
        privateMediaMetadataIncluded: false,
        mediaContentIncluded: false,
      },
    });
    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://203-0-114-10.abc123def456.plex.direct:32400/library/metadata/1049",
    );
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-Plex-Token"]).toBe("test-plex-token");
    expect(headers.Accept).toBe("application/json");
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("error");
  });

  it.each([
    "http://203-0-114-10.abc123.plex.direct:32400",
    "https://plex.direct",
    "https://example.com",
    "https://203-0-114-10.abc123.plex.direct:32400/library",
    "https://user@203-0-114-10.abc123.plex.direct:32400",
  ])(
    "rejects an unsafe Plex server origin before network access: %s",
    async (serverOrigin) => {
      const fetchMock = jest.spyOn(global, "fetch");
      await expect(
        new PlexPersonalMediaServerApiAdapter().getSelectedItemLifecycle({
          ...credentials,
          serverOrigin,
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
      new PlexPersonalMediaServerApiAdapter().getSelectedItemLifecycle(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "policy_blocked" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe rating keys before network access", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new PlexPersonalMediaServerApiAdapter().getSelectedItemLifecycle({
        ...credentials,
        ratingKey: "../private",
      }),
    ).rejects.toMatchObject({
      code: "provider_validation_error",
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps token failure without exposing provider response content", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() => json({ message: "private" }, 401));
    await expect(
      new PlexPersonalMediaServerApiAdapter().getSelectedItemLifecycle(
        credentials,
      ),
    ).rejects.toMatchObject({ code: "token_expired", statusCode: 401 });
  });
});
