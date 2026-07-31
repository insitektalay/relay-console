import { BadRequestException } from "@nestjs/common";
import { Readable } from "stream";
import { RELAY_ATTACHMENT_MAX_BYTES } from "./attachment-upload-policy";
import { RelaySyncController } from "./relay-sync.controller";

describe("RelaySyncController attachment streaming boundary", () => {
  function fixture() {
    const sync = {
      uploadAttachmentContent: jest.fn().mockResolvedValue({
        attachmentId: "att_example",
        status: "available",
        byteSize: 5,
      }),
    } as any;
    return { controller: new RelaySyncController(sync), sync };
  }

  it("rejects missing and oversized lengths before handing off the request stream", () => {
    const { controller, sync } = fixture();
    const request = Readable.from(Buffer.from("hello")) as any;

    expect(() =>
      controller.uploadAttachment(
        "10000000-0000-4000-8000-000000000001",
        "Bearer payload.signature",
        undefined,
        "text/plain",
        undefined,
        undefined,
        request,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      controller.uploadAttachment(
        "10000000-0000-4000-8000-000000000001",
        "Bearer payload.signature",
        String(RELAY_ATTACHMENT_MAX_BYTES + 1),
        "text/plain",
        undefined,
        undefined,
        request,
      ),
    ).toThrow("ATTACHMENT_CONTENT_LENGTH_REQUIRED");
    expect(sync.uploadAttachmentContent).not.toHaveBeenCalled();
  });

  it("rejects transfer/content encodings that would make the exact length ambiguous", () => {
    const { controller, sync } = fixture();
    const request = Readable.from(Buffer.from("hello")) as any;

    expect(() =>
      controller.uploadAttachment(
        "10000000-0000-4000-8000-000000000001",
        "Bearer payload.signature",
        "5",
        "text/plain",
        "gzip",
        undefined,
        request,
      ),
    ).toThrow("ATTACHMENT_CONTENT_ENCODING_DENIED");
    expect(() =>
      controller.uploadAttachment(
        "10000000-0000-4000-8000-000000000001",
        "Bearer payload.signature",
        "5",
        "text/plain",
        undefined,
        "chunked",
        request,
      ),
    ).toThrow("ATTACHMENT_CONTENT_ENCODING_DENIED");
    expect(sync.uploadAttachmentContent).not.toHaveBeenCalled();
  });

  it("passes the unconsumed stream and exact framing to the service", async () => {
    const { controller, sync } = fixture();
    const request = Readable.from(Buffer.from("hello")) as any;

    await controller.uploadAttachment(
      "10000000-0000-4000-8000-000000000001",
      "Bearer payload.signature",
      "5",
      "text/plain",
      undefined,
      undefined,
      request,
    );

    expect(sync.uploadAttachmentContent).toHaveBeenCalledWith(
      "10000000-0000-4000-8000-000000000001",
      "payload.signature",
      request,
      { contentLength: 5, contentType: "text/plain" },
    );
    expect(request.readableEnded).toBe(false);
  });
});
