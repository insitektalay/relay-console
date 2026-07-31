import {
  isRelayAttachmentContentRequest,
  shouldParseJsonRequest,
  shouldParseUrlencodedRequest,
} from "./common/http/request-body-routing";

describe("request body routing", () => {
  const rowId = "00000000-0000-4000-8000-000000000001";

  it("leaves only the exact binary attachment content route unparsed", () => {
    expect(
      isRelayAttachmentContentRequest(
        "POST",
        `/api/v1/attachments/uploads/${rowId}/content`,
      ),
    ).toBe(true);
    expect(
      isRelayAttachmentContentRequest(
        "GET",
        `/api/v1/attachments/uploads/${rowId}/content`,
      ),
    ).toBe(false);
    expect(
      isRelayAttachmentContentRequest(
        "POST",
        `/api/v1/attachments/uploads/not-a-uuid/content`,
      ),
    ).toBe(false);
    expect(
      isRelayAttachmentContentRequest(
        "POST",
        `/api/v1/workspaces/${rowId}/mutations`,
      ),
    ).toBe(false);
  });

  it("continues parsing ordinary JSON and JSON-suffix media types", () => {
    const ordinary = {
      method: "POST",
      originalUrl: "/api/v1/workspaces/example/mutations",
      url: "/api/v1/workspaces/example/mutations",
      is: jest.fn().mockReturnValue("application/json"),
    } as any;
    expect(shouldParseJsonRequest(ordinary)).toBe(true);
    expect(ordinary.is).toHaveBeenCalledWith([
      "application/json",
      "application/*+json",
    ]);
  });

  it("does not invoke media-type parsing for the direct binary route", () => {
    const upload = {
      method: "POST",
      originalUrl: `/api/v1/attachments/uploads/${rowId}/content`,
      url: `/api/v1/attachments/uploads/${rowId}/content`,
      is: jest.fn(),
    } as any;
    expect(shouldParseJsonRequest(upload)).toBe(false);
    expect(shouldParseUrlencodedRequest(upload)).toBe(false);
    expect(upload.is).not.toHaveBeenCalled();
  });

  it("continues parsing ordinary form bodies", () => {
    const ordinary = {
      method: "POST",
      originalUrl: "/api/v1/auth/login",
      url: "/api/v1/auth/login",
      is: jest.fn().mockReturnValue("application/x-www-form-urlencoded"),
    } as any;
    expect(shouldParseUrlencodedRequest(ordinary)).toBe(true);
    expect(ordinary.is).toHaveBeenCalledWith(
      "application/x-www-form-urlencoded",
    );
  });
});
