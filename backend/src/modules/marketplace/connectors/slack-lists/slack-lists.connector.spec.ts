import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  SlackListsApiAdapter,
  SlackListsApiError,
} from "./slack-lists-api.adapter";
import { SLACK_LISTS_CONNECTOR_MANIFEST } from "./slack-lists.connector";

describe("Slack Lists Marketplace connector", () => {
  afterEach(() => jest.restoreAllMocks());
  const credentials = { accessToken: "slack-lists-token-fixture" };
  it("registers encrypted customer token auth and both profiles", () => {
    expect(new MarketplaceConnectorRegistry().get("slack-lists")).toBe(
      SLACK_LISTS_CONNECTOR_MANIFEST,
    );
    expect(SLACK_LISTS_CONNECTOR_MANIFEST.auth).toMatchObject({
      type: "api_key",
      credentialSchema: [
        {
          name: "SLACK_LISTS_TOKEN",
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    });
    expect(
      SLACK_LISTS_CONNECTOR_MANIFEST.approvalProfiles.map(
        (profile) => profile.id,
      ),
    ).toEqual(["slack_lists_safe", "dangerously_skip_permissions"]);
  });
  it("pins bounded item reads to the documented Slack method", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 }),
      );
    await new SlackListsApiAdapter().listItems(credentials, {
      listId: "F1234",
      limit: 999,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://slack.com/api/slackLists.items.list");
    expect(JSON.parse(String(init?.body))).toEqual({
      list_id: "F1234",
      limit: 50,
    });
    expect(String(init?.body)).not.toContain("slack-lists-token-fixture");
  });
  it("rejects invalid IDs before a provider call", async () => {
    const fetchMock = jest.spyOn(global, "fetch");
    await expect(
      new SlackListsApiAdapter().listItems(credentials, {
        listId: "../private",
      }),
    ).rejects.toBeInstanceOf(SlackListsApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("removes sensitive field types from list responses", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              id: "Rec1234",
              list_id: "F1234",
              fields: [
                { key: "title", column_id: "Col1234", text: "Launch" },
                {
                  key: "owner_email",
                  column_id: "Col5678",
                  email: ["private@example.com"],
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new SlackListsApiAdapter().listItems(credentials, {
      listId: "F1234",
    });
    expect(result.items[0].fields).toEqual([
      { columnId: "Col1234", key: "title", text: "Launch", value: null },
    ]);
  });
});
