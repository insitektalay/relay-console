import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class YouTubeApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class YouTubeApiAdapter {
  private readonly origin = "https://www.googleapis.com";

  health(token: string) {
    this.token(token);
    return {
      dataApiV3Only: true,
      readOnlyV1: true,
      exactScopeOnly: true,
      connectedChannelOnly: true,
      youtubeAttributionRequired: true,
      writesEnabled: false,
      providerRequestCount: 0,
    };
  }

  async getMyChannel(token: string) {
    const value = await this.request(token, "/youtube/v3/channels", {
      part: "snippet,contentDetails,statistics,status",
      mine: "true",
      maxResults: "1",
    });
    const all = this.array(value.items);
    return {
      semanticReadContract: "youtube-connected-channel-v3",
      channels: all.slice(0, 1).map((item) => this.channel(item)),
      resultCount: Math.min(all.length, 1),
      truncated: Boolean(value.nextPageToken) || all.length > 1,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listMyPlaylists(token: string, input: JsonObject) {
    const maximum = this.maxResults(input.maxResults);
    const value = await this.request(token, "/youtube/v3/playlists", {
      part: "snippet,contentDetails,status",
      mine: "true",
      maxResults: String(maximum),
    });
    const all = this.array(value.items);
    return {
      semanticReadContract: "youtube-owned-playlists-v3",
      playlists: all.slice(0, maximum).map((item) => this.playlist(item)),
      resultCount: Math.min(all.length, maximum),
      truncated: Boolean(value.nextPageToken) || all.length > maximum,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async listPlaylistItems(token: string, input: JsonObject) {
    const playlistId = this.resourceId(input.playlistId, "playlistId", 128);
    const maximum = this.maxResults(input.maxResults);
    const value = await this.request(token, "/youtube/v3/playlistItems", {
      part: "snippet,contentDetails,status",
      playlistId,
      maxResults: String(maximum),
    });
    const all = this.array(value.items);
    return {
      semanticReadContract: "youtube-explicit-playlist-items-v3",
      playlistId,
      playlistItems: all
        .slice(0, maximum)
        .map((item) => this.playlistItem(item)),
      resultCount: Math.min(all.length, maximum),
      truncated: Boolean(value.nextPageToken) || all.length > maximum,
      nextPageFollowed: false,
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  async getVideos(token: string, input: JsonObject) {
    const videoIds = this.videoIds(input.videoIds);
    const value = await this.request(token, "/youtube/v3/videos", {
      part: "snippet,contentDetails,statistics,status",
      id: videoIds.join(","),
    });
    const all = this.array(value.items);
    return {
      semanticReadContract: "youtube-explicit-videos-v3",
      requestedVideoCount: videoIds.length,
      videos: all.slice(0, 25).map((item) => this.video(item)),
      resultCount: Math.min(all.length, 25),
      ...this.boundary(),
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    path: string,
    query: Record<string, string>,
  ) {
    this.token(token);
    const url = new URL(path, this.origin);
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    if (!this.safeUrl(url))
      throw new YouTubeApiError(
        "provider_validation_error",
        "YouTube URL or query is outside Relay's Data API v3 allowlist.",
      );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new YouTubeApiError(
        "provider_unavailable",
        "YouTube Data API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1_000_000)
      throw new YouTubeApiError(
        "provider_validation_error",
        "YouTube Data API response exceeded Relay's 1 MB bound.",
      );
    if (!response.ok)
      throw new YouTubeApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "YouTube Data API rejected the bounded read request.",
        response.status,
      );
    try {
      return this.object(raw ? JSON.parse(raw) : {});
    } catch {
      throw new YouTubeApiError(
        "provider_validation_error",
        "YouTube Data API returned invalid JSON.",
      );
    }
  }

  private safeUrl(url: URL) {
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.googleapis.com" ||
      url.username ||
      url.password ||
      url.hash
    )
      return false;
    const values = Object.fromEntries(url.searchParams.entries());
    const keys = [...url.searchParams.keys()].sort().join(",");
    if (url.pathname === "/youtube/v3/channels")
      return (
        keys === "maxResults,mine,part" &&
        values.part === "snippet,contentDetails,statistics,status" &&
        values.mine === "true" &&
        values.maxResults === "1"
      );
    if (url.pathname === "/youtube/v3/playlists")
      return (
        keys === "maxResults,mine,part" &&
        values.part === "snippet,contentDetails,status" &&
        values.mine === "true" &&
        this.validMaximum(values.maxResults)
      );
    if (url.pathname === "/youtube/v3/playlistItems")
      return (
        keys === "maxResults,part,playlistId" &&
        values.part === "snippet,contentDetails,status" &&
        this.validMaximum(values.maxResults) &&
        /^[A-Za-z0-9_-]{1,128}$/.test(values.playlistId ?? "")
      );
    if (url.pathname === "/youtube/v3/videos")
      return (
        keys === "id,part" &&
        values.part === "snippet,contentDetails,statistics,status" &&
        this.validVideoIdList(values.id)
      );
    return false;
  }

  private channel(value: unknown) {
    const item = this.object(value);
    const snippet = this.object(item.snippet);
    const content = this.object(item.contentDetails);
    const related = this.object(content.relatedPlaylists);
    const status = this.object(item.status);
    const statistics = this.object(item.statistics);
    return {
      id: this.scalar(item.id, 64),
      title: this.scalar(snippet.title, 256),
      description: this.scalar(snippet.description, 2_000),
      customUrl: this.scalar(snippet.customUrl, 128),
      publishedAt: this.scalar(snippet.publishedAt, 40),
      uploadsPlaylistId: this.scalar(related.uploads, 128),
      privacyStatus: this.scalar(status.privacyStatus, 32),
      madeForKids: this.boolean(status.madeForKids),
      isLinked: this.boolean(status.isLinked),
      longUploadsStatus: this.scalar(status.longUploadsStatus, 64),
      statistics: this.statistics(statistics),
      ...this.attribution(),
    };
  }

  private playlist(value: unknown) {
    const item = this.object(value);
    const snippet = this.object(item.snippet);
    const content = this.object(item.contentDetails);
    const status = this.object(item.status);
    return {
      id: this.scalar(item.id, 128),
      title: this.scalar(snippet.title, 256),
      description: this.scalar(snippet.description, 2_000),
      publishedAt: this.scalar(snippet.publishedAt, 40),
      channelId: this.scalar(snippet.channelId, 64),
      channelTitle: this.scalar(snippet.channelTitle, 256),
      itemCount: this.number(content.itemCount),
      privacyStatus: this.scalar(status.privacyStatus, 32),
      ...this.attribution(),
    };
  }

  private playlistItem(value: unknown) {
    const item = this.object(value);
    const snippet = this.object(item.snippet);
    const resource = this.object(snippet.resourceId);
    const content = this.object(item.contentDetails);
    const status = this.object(item.status);
    return {
      id: this.scalar(item.id, 256),
      title: this.scalar(snippet.title, 256),
      description: this.scalar(snippet.description, 2_000),
      publishedAt: this.scalar(snippet.publishedAt, 40),
      videoPublishedAt: this.scalar(content.videoPublishedAt, 40),
      playlistId: this.scalar(snippet.playlistId, 128),
      position: this.number(snippet.position),
      videoId: this.scalar(content.videoId ?? resource.videoId, 64),
      videoOwnerChannelId: this.scalar(snippet.videoOwnerChannelId, 64),
      videoOwnerChannelTitle: this.scalar(snippet.videoOwnerChannelTitle, 256),
      privacyStatus: this.scalar(status.privacyStatus, 32),
      ...this.attribution(),
    };
  }

  private video(value: unknown) {
    const item = this.object(value);
    const snippet = this.object(item.snippet);
    const content = this.object(item.contentDetails);
    const status = this.object(item.status);
    return {
      id: this.scalar(item.id, 64),
      title: this.scalar(snippet.title, 256),
      description: this.scalar(snippet.description, 2_000),
      publishedAt: this.scalar(snippet.publishedAt, 40),
      channelId: this.scalar(snippet.channelId, 64),
      channelTitle: this.scalar(snippet.channelTitle, 256),
      liveBroadcastContent: this.scalar(snippet.liveBroadcastContent, 32),
      duration: this.scalar(content.duration, 64),
      definition: this.scalar(content.definition, 16),
      dimension: this.scalar(content.dimension, 16),
      caption: this.scalar(content.caption, 16),
      licensedContent: this.boolean(content.licensedContent),
      projection: this.scalar(content.projection, 32),
      privacyStatus: this.scalar(status.privacyStatus, 32),
      publishAt: this.scalar(status.publishAt, 40),
      embeddable: this.boolean(status.embeddable),
      license: this.scalar(status.license, 32),
      publicStatsViewable: this.boolean(status.publicStatsViewable),
      madeForKids: this.boolean(status.madeForKids),
      statistics: this.statistics(this.object(item.statistics)),
      tagsReturned: false,
      thumbnailsReturned: false,
      ...this.attribution(),
    };
  }

  private statistics(value: JsonObject) {
    return {
      viewCount: this.intString(value.viewCount),
      subscriberCount: this.intString(value.subscriberCount),
      hiddenSubscriberCount: this.boolean(value.hiddenSubscriberCount),
      videoCount: this.intString(value.videoCount),
      likeCount: this.intString(value.likeCount),
      commentCount: this.intString(value.commentCount),
      favoriteCount: this.intString(value.favoriteCount),
    };
  }

  private attribution() {
    return {
      source: "YouTube",
      youtubeAttributionRequired: true,
      redactionStatus: "private-state-excluded",
    };
  }

  private boundary() {
    return {
      dataApiV3Only: true,
      readOnlyV1: true,
      exactScopeOnly: true,
      connectedChannelOnly: true,
      maxResults: 25,
      youtubeAttributionRequired: true,
      writesEnabled: false,
      searchEnabled: false,
      historyEnabled: false,
      watchLaterEnabled: false,
      analyticsEnabled: false,
      partnerEnabled: false,
      automaticPagination: false,
      rawProviderToolExposure: false,
      serviceAccountEnabled: false,
      redactionStatus:
        "search-history-watch-later-pagination-export-mutations-advanced-raw-excluded",
    };
  }

  private maxResults(value: unknown) {
    if (value === undefined || value === null) return 25;
    if (
      !Number.isInteger(value) ||
      (value as number) < 1 ||
      (value as number) > 25
    )
      throw new YouTubeApiError(
        "provider_validation_error",
        "maxResults must be an integer from 1 through 25.",
      );
    return value as number;
  }

  private validMaximum(value: string | undefined) {
    return Boolean(value && /^(?:[1-9]|1[0-9]|2[0-5])$/.test(value));
  }

  private resourceId(value: unknown, field: string, maximum: number) {
    if (
      typeof value !== "string" ||
      value.length > maximum ||
      !/^[A-Za-z0-9_-]+$/.test(value)
    )
      throw new YouTubeApiError(
        "provider_validation_error",
        `${field} must be an explicit YouTube resource ID.`,
      );
    return value;
  }

  private videoIds(value: unknown) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 25)
      throw new YouTubeApiError(
        "provider_validation_error",
        "videoIds must contain 1 through 25 explicit YouTube video IDs.",
      );
    const ids = value.map((entry) => this.resourceId(entry, "videoId", 64));
    if (new Set(ids).size !== ids.length)
      throw new YouTubeApiError(
        "provider_validation_error",
        "videoIds must not contain duplicates.",
      );
    return ids;
  }

  private validVideoIdList(value: string | undefined) {
    if (!value) return false;
    const ids = value.split(",");
    return (
      ids.length >= 1 &&
      ids.length <= 25 &&
      new Set(ids).size === ids.length &&
      ids.every((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))
    );
  }

  private token(value: string) {
    if (!value || value.length > 8_000)
      throw new YouTubeApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private scalar(value: unknown, maximum: number): string | null {
    return typeof value === "string" ? value.slice(0, maximum) : null;
  }

  private intString(value: unknown): string | null {
    return typeof value === "string" && /^[0-9]+$/.test(value)
      ? value.slice(0, 40)
      : typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? String(value)
        : null;
  }

  private number(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private boolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }
}
