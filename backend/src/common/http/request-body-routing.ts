import { Request } from "express";

const ATTACHMENT_CONTENT_PATH =
  /\/attachments\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/content\/?$/i;

export function isRelayAttachmentContentRequest(
  method: string | undefined,
  requestUrl: string | undefined,
) {
  const path = requestUrl?.split("?", 1)[0] ?? "";
  return method === "POST" && ATTACHMENT_CONTENT_PATH.test(path);
}

export function shouldParseJsonRequest(request: Request) {
  if (
    isRelayAttachmentContentRequest(
      request.method,
      request.originalUrl || request.url,
    )
  )
    return false;
  return Boolean(request.is(["application/json", "application/*+json"]));
}

export function shouldParseUrlencodedRequest(request: Request) {
  if (
    isRelayAttachmentContentRequest(
      request.method,
      request.originalUrl || request.url,
    )
  )
    return false;
  return Boolean(request.is("application/x-www-form-urlencoded"));
}
