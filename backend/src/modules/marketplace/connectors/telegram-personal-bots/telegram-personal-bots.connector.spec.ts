import { MarketplaceConnectorRegistry } from "../connector-registry";
import {
  TelegramPersonalBotsApiAdapter,
  TelegramPersonalBotsApiError,
} from "./telegram-personal-bots-api.adapter";
import { TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST } from "./telegram-personal-bots.connector";

const credentials = {
  botToken: "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi",
  allowedChatIds: ["-1001234567890", "123456789"],
};

describe("Telegram Personal Bots connector", () => {
  afterEach(() => jest.restoreAllMocks());

  it("registers a user-owned bot-token connector with safe communication defaults", () => {
    expect(
      new MarketplaceConnectorRegistry().get("telegram-personal-bots"),
    ).toBe(TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST);
    expect(
      TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST.auth.credentialSchema,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "TELEGRAM_BOT_TOKEN", secret: true }),
        expect.objectContaining({
          name: "TELEGRAM_ALLOWED_CHAT_IDS",
          secret: false,
        }),
      ]),
    );
    expect(
      TELEGRAM_PERSONAL_BOTS_CONNECTOR_MANIFEST.approvalProfiles[0]
        .approvalRequiredActions,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "telegram_bot_send_message" }),
        expect.objectContaining({ id: "telegram_bot_delete_message" }),
      ]),
    );
  });

  it("validates the token with getMe without returning or logging the secret", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            id: 123456789,
            is_bot: true,
            first_name: "Relay",
            username: "relay_test_bot",
          },
        }),
        { status: 200 },
      ),
    );
    const result = await new TelegramPersonalBotsApiAdapter().health(
      credentials,
    );
    expect(result).toMatchObject({
      id: "123456789",
      username: "relay_test_bot",
      allowedChatCount: 2,
    });
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain(
      "https://api.telegram.org/bot",
    );
    expect(JSON.stringify(result)).not.toContain(credentials.botToken);
  });

  it("enforces the chat allowlist and bounds outgoing text", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            result: { message_id: 7, chat: { id: -1001234567890 } },
          }),
          { status: 200 },
        ),
      );
    await new TelegramPersonalBotsApiAdapter().sendMessage(credentials, {
      chatId: "-1001234567890",
      text: "Approved update",
    });
    expect(
      JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)),
    ).toMatchObject({
      chat_id: "-1001234567890",
      text: "Approved update",
      protect_content: true,
    });
    expect(() =>
      new TelegramPersonalBotsApiAdapter().sendMessage(credentials, {
        chatId: "999999",
        text: "Outside boundary",
      }),
    ).toThrow(
      expect.objectContaining<Partial<TelegramPersonalBotsApiError>>({
        code: "policy_blocked",
      }),
    );
  });

  it("filters queued updates to configured chats and never long-polls", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: [
            {
              update_id: 10,
              message: { message_id: 1, chat: { id: 123456789 }, text: "keep" },
            },
            {
              update_id: 11,
              message: { message_id: 2, chat: { id: 987654321 }, text: "drop" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await new TelegramPersonalBotsApiAdapter().getUpdates(
      credentials,
      { limit: 10 },
    );
    expect(result).toMatchObject({
      returnedCount: 1,
      excludedCount: 1,
      nextOffset: 12,
    });
    expect(JSON.stringify(result)).not.toContain("drop");
    expect(
      JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body)),
    ).toMatchObject({ timeout: 0, limit: 10 });
  });
});
