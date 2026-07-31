import {
  GooglePhotosApiAdapter,
  GooglePhotosApiError,
} from "./google-photos-api.adapter";
import {
  GOOGLE_PHOTOS_CONNECTOR_MANIFEST,
  GOOGLE_PHOTOS_SCOPES,
} from "./google-photos.connector";

describe("Google Photos connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses only the exact Picker scope and exposes four bounded tools", () => {
    expect(GOOGLE_PHOTOS_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    ]);
    expect(GOOGLE_PHOTOS_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      GOOGLE_PHOTOS_CONNECTOR_MANIFEST.tools
        .filter((tool) => tool.approvalRequired)
        .map((tool) => tool.functionName),
    ).toEqual([
      "google_photos_picker_session_create",
      "google_photos_picker_session_delete",
    ]);
    expect(JSON.stringify(GOOGLE_PHOTOS_CONNECTOR_MANIFEST)).not.toContain(
      'photoslibrary.readonly"',
    );
  });

  it("creates at most twenty-five-item user-controlled sessions", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session_1",
          pickerUri: "https://photos.google.com/picker/session_1",
          pickingConfig: { maxItemCount: "25" },
          mediaItemsSet: false,
        }),
        { status: 200 },
      ),
    );
    const result = await new GooglePhotosApiAdapter().createPickerSession(
      "token",
      { maxItemCount: 25 },
    );
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(JSON.parse(String(request.body))).toEqual({
      pickingConfig: { maxItemCount: "25" },
    });
    expect(result).toMatchObject({
      operation: "create_picker_session",
      session: { iframeAllowed: false, automaticPolling: false },
    });
    await expect(
      new GooglePhotosApiAdapter().createPickerSession("token", {
        maxItemCount: 26,
      }),
    ).rejects.toBeInstanceOf(GooglePhotosApiError);
  });

  it("lists one metadata-only page and withholds base URLs and page tokens", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          mediaItems: [
            {
              id: "media_1",
              type: "PHOTO",
              mediaFile: {
                baseUrl: "https://content.example/secret",
                mimeType: "image/jpeg",
                filename: "photo.jpg",
                mediaFileMetadata: {
                  width: "1200",
                  height: "800",
                  cameraMake: "excluded",
                },
              },
            },
          ],
          nextPageToken: "withheld",
        }),
        { status: 200 },
      ),
    );
    const result = await new GooglePhotosApiAdapter().listPickedMedia("token", {
      sessionId: "session_1",
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.searchParams.get("pageSize")).toBe("25");
    expect(url.searchParams.get("sessionId")).toBe("session_1");
    expect(result).toMatchObject({
      count: 1,
      nextPageTokenPresent: true,
      nextPageFollowed: false,
      baseURLReturned: false,
      mediaItems: [{ cameraExifReturned: false }],
    });
    expect(JSON.stringify(result)).not.toContain("content.example");
    expect(JSON.stringify(result)).not.toContain("withheld");
  });

  it("rejects a Picker response that redirects outside Google Photos", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "session_1",
          pickerUri: "https://example.com/steal",
        }),
        { status: 200 },
      ),
    );
    await expect(
      new GooglePhotosApiAdapter().getPickerSession("token", {
        sessionId: "session_1",
      }),
    ).rejects.toBeInstanceOf(GooglePhotosApiError);
  });
});
