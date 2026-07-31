import { DiscordApiAdapter, DiscordApiError } from "./discord-api.adapter";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const binding = { applicationId: "123456789012345678", guildId: "223456789012345678", channelId: "323456789012345678" };

describe("DiscordApiAdapter", () => {
  it("uses only fixed bot and selected-guild/channel GETs with Bot authorization", async () => {
    const calls: string[] = [];
    const adapter = new DiscordApiAdapter(async (url, init) => {
      expect(init.method).toBe("GET"); expect(init.redirect).toBe("error"); expect((init.headers as Record<string, string>).Authorization).toBe("Bot token");
      const parsed = new URL(url); calls.push(parsed.pathname + parsed.search);
      if (parsed.pathname === "/api/v10/users/@me") return response({ id: binding.applicationId, username: "Relay", bot: true, email: "blocked@example.com" });
      if (parsed.pathname.endsWith("/channels")) return response([{ id: binding.channelId, guild_id: binding.guildId, name: "launch", type: 0, nsfw: false }, { id: "423456789012345678", guild_id: binding.guildId, name: "private", type: 0, nsfw: true }, { id: "523456789012345678", guild_id: binding.guildId, name: "voice", type: 2 }]);
      if (parsed.pathname.endsWith("/messages")) return response([{ id: "623456789012345678", channel_id: binding.channelId, content: "Ready to launch", timestamp: "2026-07-17T12:00:00Z", author: { id: "blocked" }, mentions: [{ id: "blocked" }], attachments: [{ id: "blocked" }], embeds: [{}], reactions: [{}] }]);
      return response({ id: binding.guildId, name: "Relay Guild", owner_id: "blocked", members: [{ id: "blocked" }] });
    });
    expect(await adapter.getBot("token")).toEqual({ bot: { id: binding.applicationId, username: "Relay", bot: true, identityOnly: true } });
    const guild = await adapter.getSelectedGuild("token", binding); expect(guild.guild).not.toHaveProperty("owner_id");
    const channels = await adapter.listSelectedGuildChannels("token", binding); expect(channels.channels).toHaveLength(1); expect(channels.channels[0]).toMatchObject({ id: binding.channelId, nsfw: false });
    const messages = await adapter.listSelectedChannelMessages("token", binding); expect(messages.messages[0]).toMatchObject({ content: "Ready to launch", authorsPeopleExcluded: true, mentionsRichContentExcluded: true }); expect(messages.messages[0]).not.toHaveProperty("author"); expect(messages.messages[0]).not.toHaveProperty("attachments");
    expect(calls).toEqual(["/api/v10/users/@me", `/api/v10/guilds/${binding.guildId}`, `/api/v10/guilds/${binding.guildId}/channels`, `/api/v10/channels/${binding.channelId}/messages?limit=25`]);
  });

  it("rejects a user token identity and invalid bindings", async () => {
    const user = new DiscordApiAdapter(async () => response({ id: binding.applicationId, username: "Person", bot: false }));
    await expect(user.getBot("token")).rejects.toMatchObject<Partial<DiscordApiError>>({ code: "discord_bot_required" });
    await expect(user.getSelectedGuild("token", { ...binding, guildId: "../1" })).rejects.toMatchObject({ code: "discord_binding_invalid" });
  });

  it("maps throttling to a provider-safe error", async () => {
    const adapter = new DiscordApiAdapter(async () => response({}, 429));
    await expect(adapter.listSelectedChannelMessages("token", binding)).rejects.toMatchObject<Partial<DiscordApiError>>({ code: "discord_rate_limited", statusCode: 429 });
  });
});
