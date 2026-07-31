import { GmailApiAdapter, type GmailCredentials } from "./gmail-api.adapter";
const credentials: GmailCredentials = {
  accessToken: "gmail-access",
  accountEmail: "relay@example.com",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const encoded = Buffer.from("Safe body", "utf8").toString("base64url");
describe("GmailApiAdapter", () => {
  it("searches bounded messages and resolves safe metadata without page tokens", async () => {
    const requester = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          messages: [{ id: "msg_1" }],
          nextPageToken: "must-not-follow",
        }),
      )
      .mockResolvedValueOnce(
        response({
          id: "msg_1",
          threadId: "thread_1",
          snippet: "Hello",
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "Subject", value: "Status" },
            ],
          },
        }),
      );
    const result = await new GmailApiAdapter(requester).searchMessages(
      credentials,
      { query: "newer_than:7d", limit: 5 },
    );
    expect(result).toMatchObject({
      limit: 5,
      automaticPagination: false,
      messages: [{ subject: "Status", from: "sender@example.com" }],
    });
    expect(requester).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("must-not-follow");
  });
  it("reads a bounded plain-text excerpt and excludes attachments", async () => {
    const requester = jest.fn().mockResolvedValue(
      response({
        id: "msg_1",
        payload: {
          mimeType: "multipart/mixed",
          headers: [],
          parts: [
            { mimeType: "text/plain", body: { data: encoded } },
            {
              mimeType: "application/pdf",
              filename: "secret.pdf",
              body: { attachmentId: "must-not-leak" },
            },
          ],
        },
      }),
    );
    const result = await new GmailApiAdapter(requester).getMessage(
      credentials,
      { messageId: "msg_1" },
    );
    expect(result.message.bodyExcerpt).toBe("Safe body");
    expect(JSON.stringify(result)).not.toContain("must-not-leak");
  });
  it("creates drafts and sends only bounded reviewed MIME", async () => {
    const requester = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve(response({ id: "sent_1", threadId: "thread_1" })),
      );
    const adapter = new GmailApiAdapter(requester);
    await adapter.createDraft(credentials, {
      to: ["person@example.com"],
      subject: "Hello",
      body: "Draft body",
    });
    const body = JSON.parse(String(requester.mock.calls[0][1].body));
    expect(Buffer.from(body.message.raw, "base64url").toString()).toContain(
      "Subject: Hello",
    );
    await adapter.sendMessage(credentials, {
      to: ["person@example.com"],
      subject: "Hello",
      body: "Send body",
    });
    expect(requester.mock.calls[1][0]).toContain("/messages/send");
  });
  it("binds the exact account and maps rate limits", async () => {
    await expect(
      new GmailApiAdapter(
        jest
          .fn()
          .mockResolvedValue(response({ emailAddress: "other@example.com" })),
      ).health(credentials),
    ).rejects.toMatchObject({ code: "gmail_account_binding_mismatch" });
    await expect(
      new GmailApiAdapter(
        jest.fn().mockResolvedValue(response({}, 429)),
      ).listLabels(credentials),
    ).rejects.toMatchObject({ code: "gmail_rate_limited" });
  });
});
