import { PinterestApiAdapter } from "./pinterest-api.adapter";
import {
  PINTEREST_CONNECTOR_MANIFEST,
  PINTEREST_SCOPES,
} from "./pinterest.connector";
describe("Pinterest connector", () => {
  afterEach(() => jest.restoreAllMocks());
  it("registers exact scopes, four reads and two policies", () => {
    expect(PINTEREST_SCOPES).toEqual([
      "user_accounts:read",
      "boards:read",
      "pins:read",
    ]);
    expect(PINTEREST_CONNECTOR_MANIFEST.tools).toHaveLength(4);
    expect(
      PINTEREST_CONNECTOR_MANIFEST.approvalProfiles.map((item) => item.id),
    ).toEqual(["pinterest_safe", "dangerously_skip_permissions"]);
  });
  it("bounds list reads and never follows bookmarks", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              { id: "board_1", name: "Ideas", owner: { username: "relay" } },
            ],
            bookmark: "ignored",
          }),
          { status: 200 },
        ),
      );
    const boards = await new PinterestApiAdapter().listBoards(
      "secret-token",
      "relay",
      99,
    );
    expect(boards).toHaveLength(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("page_size=10");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects content outside the bound account", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "pin_1", board_owner: { username: "other" } }),
          { status: 200 },
        ),
      );
    await expect(
      new PinterestApiAdapter().getPin("secret-token", "relay", "pin_1"),
    ).rejects.toMatchObject({ code: "provider_validation_error" });
  });
});
