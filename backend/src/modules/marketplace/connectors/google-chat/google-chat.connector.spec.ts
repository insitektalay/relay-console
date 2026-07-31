import {
  GoogleChatApiAdapter,
  GoogleChatApiError,
} from "./google-chat-api.adapter";
import {
  GOOGLE_CHAT_CONNECTOR_MANIFEST,
  GOOGLE_CHAT_SCOPES,
} from "./google-chat.connector";

describe("Google Chat connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses exact user OAuth scopes and exposes four bounded tools", () => {
    expect(GOOGLE_CHAT_SCOPES).toEqual([
      "openid",
      "email",
      "https://www.googleapis.com/auth/chat.spaces.readonly",
      "https://www.googleapis.com/auth/chat.messages.readonly",
      "https://www.googleapis.com/auth/chat.messages.create",
    ]);
    expect(GOOGLE_CHAT_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      GOOGLE_CHAT_CONNECTOR_MANIFEST.tools
        .filter((tool) => tool.approvalRequired)
        .map((tool) => tool.functionName),
    ).toEqual(["google_chat_message_create"]);
  });

  it("reads one newest plain-text page and strips identities and rich content", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [
            {
              name: "spaces/space1/messages/message1",
              text: "Status is ready.",
              sender: {
                type: "HUMAN",
                name: "users/secret",
                displayName: "Excluded",
              },
              thread: { name: "spaces/space1/threads/thread1" },
              cardsV2: [{ cardId: "secret" }],
              annotations: [{ type: "USER_MENTION" }],
              attachment: [{ name: "secret" }],
            },
          ],
          nextPageToken: "withheld",
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleChatApiAdapter().listMessages("token", {
      spaceName: "spaces/space1",
    });
    const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
    expect(url.searchParams.get("pageSize")).toBe("25");
    expect(url.searchParams.get("orderBy")).toBe("createTime DESC");
    expect(url.searchParams.get("showDeleted")).toBe("false");
    expect(result).toMatchObject({
      resultCount: 1,
      nextPageTokenPresent: true,
      nextPageTokenFollowed: false,
      senderIdentityReturned: false,
      messages: [{ authorType: "HUMAN", attachmentsReturned: false }],
    });
    expect(JSON.stringify(result)).not.toContain("users/secret");
    expect(JSON.stringify(result)).not.toContain("withheld");
  });

  it("rejects mentions and cross-Space thread replies locally", () => {
    const adapter = new GoogleChatApiAdapter();
    expect(() =>
      adapter.prepareMessage({
        spaceName: "spaces/space1",
        text: "Hello @all",
      }),
    ).toThrow(GoogleChatApiError);
    expect(() =>
      adapter.prepareMessage({
        spaceName: "spaces/space1",
        text: "Hello",
        threadName: "spaces/space2/threads/thread1",
      }),
    ).toThrow(GoogleChatApiError);
  });

  it("creates idempotent plain-text replies with fail-closed thread semantics", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "spaces/space1/messages/message1",
          text: "Reply",
          thread: { name: "spaces/space1/threads/thread1" },
        }),
        { status: 200 },
      ),
    );
    const result = await new GoogleChatApiAdapter().createMessage("token", {
      spaceName: "spaces/space1",
      text: "Reply",
      threadName: "spaces/space1/threads/thread1",
      requestId: "request_123",
    });
    const [url, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(url.searchParams.get("requestId")).toBe("request_123");
    expect(url.searchParams.get("messageReplyOption")).toBe(
      "REPLY_MESSAGE_OR_FAIL",
    );
    expect(JSON.parse(String(request.body))).toEqual({
      text: "Reply",
      thread: { name: "spaces/space1/threads/thread1" },
    });
    expect(result).toMatchObject({
      operation: "create_message",
      replyFallbackAllowed: false,
    });
  });
});
