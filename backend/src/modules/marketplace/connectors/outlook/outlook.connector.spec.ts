import {
  OutlookGraphAdapter,
  OutlookGraphError,
} from "./outlook-graph.adapter";
import {
  OUTLOOK_CONNECTOR_MANIFEST,
  OUTLOOK_REQUIRED_SCOPES,
} from "./outlook.connector";

describe("Outlook connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("declares exact delegated Mail.Read and four read-only tools", () => {
    expect(OUTLOOK_REQUIRED_SCOPES).toEqual([
      "openid",
      "profile",
      "offline_access",
      "https://graph.microsoft.com/Mail.Read",
    ]);
    expect(OUTLOOK_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      OUTLOOK_CONNECTOR_MANIFEST.tools.every(
        (tool) => tool.action === "read" && !tool.approvalRequired,
      ),
    ).toBe(true);
    expect(
      OUTLOOK_CONNECTOR_MANIFEST.approvalProfiles.map((profile) => profile.id),
    ).toEqual(["outlook_read_only", "dangerously_skip_permissions"]);
  });

  it("lists bounded signed-in Inbox summaries", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            { id: "msg_1", subject: "Plan", body: { content: "blocked" } },
          ],
          "@odata.nextLink": "blocked",
        }),
        { status: 200 },
      ),
    );
    const result = await new OutlookGraphAdapter().listInboxMessages("token", {
      maxResults: 5,
    });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe("/v1.0/me/mailFolders/inbox/messages");
    expect(url.searchParams.get("$top")).toBe("5");
    expect(url.searchParams.has("$search")).toBe(false);
    expect(result).toMatchObject({
      resultCount: 1,
      truncated: true,
      nextPageFollowed: false,
      selfMailboxOnly: true,
      writesEnabled: false,
    });
    expect(JSON.stringify(result)).not.toContain("blocked");
  });

  it("uses fixed unread filter and text preference", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ value: [] }), { status: 200 }),
      );
    await new OutlookGraphAdapter().listUnreadMessages("token", {});
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(url.searchParams.get("$filter")).toBe("isRead eq false");
    expect((init.headers as Record<string, string>).Prefer).toBe(
      'outlook.body-content-type="text"',
    );
  });

  it("gets explicit message text without attachments or HTML", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_1",
          subject: "Plan",
          body: { content: "Text body" },
          attachments: [{ name: "blocked.pdf" }],
        }),
        { status: 200 },
      ),
    );
    const result = await new OutlookGraphAdapter().getMessage("token", {
      messageId: "msg_1",
    });
    expect(result.message).toMatchObject({
      body: "Text body",
      bodyContentType: "text",
      attachmentsReturned: false,
      htmlReturned: false,
      rawHeadersReturned: false,
    });
    expect(JSON.stringify(result)).not.toContain("blocked.pdf");
  });

  it("rejects invalid message IDs before fetch", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new OutlookGraphAdapter().getMessage("token", {
        messageId: "../users/other",
      }),
    ).rejects.toBeInstanceOf(OutlookGraphError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
