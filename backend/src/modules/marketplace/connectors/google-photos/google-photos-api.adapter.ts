import { safeConnectorFetch } from "../safe-connector-fetch";
import type { MarketplaceConnectorSafeErrorCode } from "../types";

type JsonObject = Record<string, unknown>;

export class GooglePhotosApiError extends Error {
  constructor(
    public readonly code: MarketplaceConnectorSafeErrorCode,
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}

export class GooglePhotosApiAdapter {
  private readonly origin = "https://photospicker.googleapis.com/v1";

  health(token: string) {
    this.token(token);
    return {
      pickerOnly: true,
      userSelectionRequired: true,
      providerRequestCount: 0,
    };
  }

  async createPickerSession(token: string, input: JsonObject) {
    const maxItemCount = this.maxItemCount(input.maxItemCount);
    const value = await this.request(
      token,
      "POST",
      `${this.origin}/sessions`,
      {},
      { pickingConfig: { maxItemCount: String(maxItemCount) } },
    );
    return {
      operation: "create_picker_session",
      session: this.session(value),
      providerRequestCount: 1,
    };
  }

  async getPickerSession(token: string, input: JsonObject) {
    const sessionId = this.sessionId(input.sessionId);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/sessions/${sessionId}`,
      {},
    );
    return {
      session: this.session(value),
      automaticPolling: false,
      providerRequestCount: 1,
    };
  }

  async listPickedMedia(token: string, input: JsonObject) {
    const sessionId = this.sessionId(input.sessionId);
    const value = await this.request(
      token,
      "GET",
      `${this.origin}/mediaItems`,
      { sessionId, pageSize: "25" },
    );
    const mediaItems = this.array(value.mediaItems)
      .slice(0, 25)
      .map((item) => this.mediaItem(item));
    return {
      mediaItems,
      count: mediaItems.length,
      nextPageTokenPresent: Boolean(this.text(value.nextPageToken, 2048)),
      nextPageFollowed: false,
      baseURLReturned: false,
      rawMediaBytesReturned: false,
      cameraExifReturned: false,
      providerRequestCount: 1,
    };
  }

  async deletePickerSession(token: string, input: JsonObject) {
    const sessionId = this.sessionId(input.sessionId);
    await this.request(
      token,
      "DELETE",
      `${this.origin}/sessions/${sessionId}`,
      {},
    );
    return {
      operation: "delete_picker_session",
      sessionId,
      sessionDeleted: true,
      userMediaDeleted: false,
      providerRequestCount: 1,
    };
  }

  private async request(
    token: string,
    method: string,
    base: string,
    query: Record<string, string>,
    body?: JsonObject,
  ) {
    this.token(token);
    const url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "photospicker.googleapis.com" ||
      !url.pathname.startsWith("/v1/")
    )
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "Google Photos Picker URL is unsafe.",
      );
    Object.entries(query).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    let response: Response;
    try {
      response = await safeConnectorFetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new GooglePhotosApiError(
        "provider_unavailable",
        "Google Photos Picker API could not be reached.",
        502,
      );
    }
    const raw = await response.text();
    if (Buffer.byteLength(raw) > 1048576)
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "Google Photos Picker response exceeded Relay bounds.",
      );
    if (!response.ok)
      throw new GooglePhotosApiError(
        response.status === 401
          ? "token_expired"
          : response.status === 403
            ? "insufficient_scope"
            : response.status === 429
              ? "provider_rate_limited"
              : response.status >= 500
                ? "provider_unavailable"
                : "provider_validation_error",
        "Google Photos Picker API rejected the bounded request.",
        response.status,
      );
    if (!raw) return {};
    try {
      return this.object(JSON.parse(raw));
    } catch {
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "Google Photos Picker API returned invalid JSON.",
      );
    }
  }

  private session(value: unknown) {
    const record = this.object(value);
    const pickerUri = this.pickerUri(record.pickerUri);
    const polling = this.object(record.pollingConfig);
    const config = this.object(record.pickingConfig);
    return {
      id: this.text(record.id, 512),
      pickerUri,
      expireTime: this.text(record.expireTime, 64),
      mediaItemsSet:
        typeof record.mediaItemsSet === "boolean" ? record.mediaItemsSet : null,
      pollInterval: this.text(polling.pollInterval, 32),
      timeoutIn: this.text(polling.timeoutIn, 32),
      maxItemCount: this.text(config.maxItemCount, 8),
      iframeAllowed: false,
      automaticPolling: false,
    };
  }

  private mediaItem(value: unknown) {
    const record = this.object(value);
    const file = this.object(record.mediaFile);
    const metadata = this.object(file.mediaFileMetadata);
    return {
      id: this.text(record.id, 512),
      createTime: this.text(record.createTime, 64),
      type: this.text(record.type, 32),
      mimeType: this.text(file.mimeType, 128),
      filename: this.text(file.filename, 512),
      width: this.numberOrText(metadata.width),
      height: this.numberOrText(metadata.height),
      baseURLReturned: false,
      rawMediaBytesReturned: false,
      cameraExifReturned: false,
    };
  }

  private token(value: string) {
    if (!value || value.length > 8000)
      throw new GooglePhotosApiError(
        "credential_missing",
        "A Google OAuth access token is required.",
        401,
      );
    return value;
  }

  private sessionId(value: unknown) {
    const sessionId = this.text(value, 512);
    if (!sessionId || !/^[A-Za-z0-9_-]+$/.test(sessionId))
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "sessionId is invalid.",
      );
    return sessionId;
  }

  private maxItemCount(value: unknown) {
    if (value == null) return 25;
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 1 ||
      value > 25
    )
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "maxItemCount must be an integer from 1 through 25.",
      );
    return value;
  }

  private pickerUri(value: unknown) {
    const raw = this.text(value, 2048);
    if (!raw)
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "Picker API returned no safe picker URI.",
      );
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "Picker API returned an invalid picker URI.",
      );
    }
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "photos.google.com" &&
        !url.hostname.endsWith(".photos.google.com"))
    )
      throw new GooglePhotosApiError(
        "provider_validation_error",
        "Picker API returned an unsafe picker URI.",
      );
    return raw;
  }

  private object(value: unknown): JsonObject {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  private array(value: unknown) {
    return Array.isArray(value) ? value : [];
  }

  private text(value: unknown, max: number) {
    return typeof value === "string" && value.length <= max ? value : null;
  }

  private numberOrText(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return this.text(value, 32);
  }
}
