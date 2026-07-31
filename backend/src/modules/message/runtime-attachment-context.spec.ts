import {
  RUNTIME_ATTACHMENTS_END_MARKER,
  RUNTIME_ATTACHMENTS_MARKER,
  withRuntimeAttachmentContext,
} from "./runtime-attachment-context";

describe("runtime attachment context", () => {
  it("makes attached image references explicit in canonical runtime text", () => {
    const prompt = withRuntimeAttachmentContext("Can you read this image?", [
      {
        filename: "screenshot.png",
        mimeType: "image/png",
        status: "attached",
        localMediaRef: "openclaw://device-1/attachment-1",
      },
    ]);

    expect(prompt).toContain(RUNTIME_ATTACHMENTS_MARKER);
    expect(prompt).toContain("screenshot.png (image/png)");
    expect(prompt).toContain("localMediaRef: openclaw://device-1/attachment-1");
    expect(prompt).toContain("do not say that no file was attached");
    expect(prompt).toContain(RUNTIME_ATTACHMENTS_END_MARKER);
    expect(prompt).toContain("Can you read this image?");
  });

  it("leaves text unchanged when no readable attachment reference exists", () => {
    expect(withRuntimeAttachmentContext("Hello", [])).toBe("Hello");
    expect(
      withRuntimeAttachmentContext("Hello", [
        {
          filename: "failed.png",
          status: "failed",
          localMediaRef: "openclaw://device-1/failed",
        },
      ]),
    ).toBe("Hello");
  });
});
