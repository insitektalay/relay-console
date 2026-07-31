import { YouTubeApiAdapter, YouTubeApiError } from "./youtube-api.adapter";
import {
  YOUTUBE_CONNECTOR_MANIFEST,
  YOUTUBE_SCOPES,
} from "./youtube.connector";

describe("YouTube connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exact youtube.readonly and exposes only four bounded reads", () => {
    expect(YOUTUBE_SCOPES).toEqual([
      "https://www.googleapis.com/auth/youtube.readonly",
    ]);
    expect(
      YOUTUBE_CONNECTOR_MANIFEST.tools.map((tool) => [
        tool.functionName,
        tool.action,
        tool.approvalRequired,
      ]),
    ).toEqual([
      ["youtube_channels_list_mine", "read", false],
      ["youtube_playlists_list_mine", "read", false],
      ["youtube_playlist_items_list", "read", false],
      ["youtube_videos_list", "read", false],
    ]);
  });

  it("reads the connected channel and preserves its uploads playlist", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "UCRelayExample",
              snippet: {
                title: "Relay Example Channel",
                description: "Creator videos",
                publishedAt: "2026-01-01T00:00:00Z",
              },
              contentDetails: {
                relatedPlaylists: { uploads: "UURelayExample" },
              },
              statistics: {
                viewCount: "9007199254740993",
                subscriberCount: "500",
                videoCount: "12",
              },
              status: { privacyStatus: "public", madeForKids: false },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new YouTubeApiAdapter().getMyChannel("token");
    expect(result).toMatchObject({
      resultCount: 1,
      nextPageFollowed: false,
      channels: [
        {
          id: "UCRelayExample",
          uploadsPlaylistId: "UURelayExample",
          statistics: { viewCount: "9007199254740993" },
          source: "YouTube",
        },
      ],
      youtubeAttributionRequired: true,
      searchEnabled: false,
      historyEnabled: false,
    });
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      "mine=true",
    );
  });

  it("lists only the requested first page of explicit playlist items", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: Array.from({ length: 30 }, (_, index) => ({
            id: `item-${index}`,
            snippet: {
              title: `Video ${index}`,
              playlistId: "PLRelayExample",
              position: index,
              resourceId: { videoId: `video-${index}` },
            },
            contentDetails: { videoId: `video-${index}` },
            status: { privacyStatus: "public" },
          })),
          nextPageToken: "not-followed",
        }),
        { status: 200 },
      ),
    );
    const result = await new YouTubeApiAdapter().listPlaylistItems("token", {
      playlistId: "PLRelayExample",
      maxResults: 25,
    });
    expect(result).toMatchObject({
      playlistId: "PLRelayExample",
      resultCount: 25,
      truncated: true,
      nextPageFollowed: false,
      automaticPagination: false,
    });
    expect(result.playlistItems).toHaveLength(25);
    const url = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(url.pathname).toBe("/youtube/v3/playlistItems");
    expect(url.searchParams.has("pageToken")).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns privacy-bounded semantic video details for explicit IDs", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "VideoExample1",
              snippet: {
                title: "Relay Console walkthrough",
                description: "A bounded description",
                channelId: "UCRelayExample",
                liveBroadcastContent: "none",
                tags: ["excluded"],
                thumbnails: {
                  default: { url: "https://example.test/private" },
                },
              },
              contentDetails: {
                duration: "PT8M14S",
                caption: "true",
                definition: "hd",
              },
              status: {
                privacyStatus: "unlisted",
                embeddable: true,
              },
              statistics: { viewCount: "42", likeCount: "7" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new YouTubeApiAdapter().getVideos("token", {
      videoIds: ["VideoExample1"],
    });
    expect(result).toMatchObject({
      requestedVideoCount: 1,
      videos: [
        {
          id: "VideoExample1",
          duration: "PT8M14S",
          caption: "true",
          privacyStatus: "unlisted",
          statistics: { viewCount: "42", likeCount: "7" },
          tagsReturned: false,
          thumbnailsReturned: false,
        },
      ],
      partnerEnabled: false,
      serviceAccountEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("example.test");
    expect(JSON.stringify(result)).not.toContain('"tags":[');
  });

  it("rejects duplicate, oversized, and query-shaped identifiers before provider access", async () => {
    const fetch = jest.spyOn(global, "fetch");
    const adapter = new YouTubeApiAdapter();
    await expect(
      adapter.getVideos("token", { videoIds: ["same", "same"] }),
    ).rejects.toBeInstanceOf(YouTubeApiError);
    await expect(
      adapter.listPlaylistItems("token", {
        playlistId: "playlist?pageToken=unsafe",
        maxResults: 25,
      }),
    ).rejects.toBeInstanceOf(YouTubeApiError);
    await expect(
      adapter.listMyPlaylists("token", { maxResults: 26 }),
    ).rejects.toBeInstanceOf(YouTubeApiError);
    expect(fetch).not.toHaveBeenCalled();
  });
});
