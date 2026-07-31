import { Injectable } from "@nestjs/common";

export class DiscordApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode?: number) { super(message); }
}

export type DiscordBinding = { applicationId: string; guildId: string; channelId: string };
type HttpClient = (url: string, init: RequestInit) => Promise<Response>;
const ORIGIN = "https://discord.com";
const SNOWFLAKE = /^\d{1,20}$/;

@Injectable()
export class DiscordApiAdapter {
  constructor(private readonly request: HttpClient = fetch) {}

  async health(token: string, binding: DiscordBinding) {
    const bot = await this.getBot(token);
    if (bot.bot.id !== binding.applicationId) throw new DiscordApiError("discord_application_mismatch", "Discord bot does not match the configured Relay application.");
    await this.getSelectedGuild(token, binding);
    const channels = await this.listSelectedGuildChannels(token, binding);
    if (!channels.channels.some((channel) => channel.id === binding.channelId)) throw new DiscordApiError("discord_channel_not_available", "Selected Discord channel is not an available non-NSFW text channel.");
    return { reachable: true, selectedGuildOnly: true, selectedChannelOnly: true, permissions: "66560", messageContentApprovalRequired: true };
  }

  async getBot(token: string) {
    const row = this.object(await this.get(token, "/api/v10/users/@me", null));
    if (row.bot !== true) throw new DiscordApiError("discord_bot_required", "Discord connection must authenticate the Relay bot, never a user account.");
    return { bot: { id: this.requiredSnowflake(row.id, "bot"), username: this.scalar(row.username, 80), bot: true, identityOnly: true } };
  }

  async getSelectedGuild(token: string, binding: DiscordBinding) {
    this.binding(binding);
    const row = this.object(await this.get(token, `/api/v10/guilds/${binding.guildId}`, binding));
    if (this.requiredSnowflake(row.id, "guild") !== binding.guildId) throw new DiscordApiError("discord_guild_mismatch", "Discord response escaped the selected guild.");
    return { guild: { id: binding.guildId, name: this.scalar(row.name, 100), description: this.scalar(row.description, 1_000), verificationLevel: this.number(row.verification_level), selectedGuildOnly: true } };
  }

  async listSelectedGuildChannels(token: string, binding: DiscordBinding) {
    this.binding(binding);
    const channels = this.array(await this.get(token, `/api/v10/guilds/${binding.guildId}/channels`, binding)).map((value) => this.object(value)).filter((row) => row.type === 0 && row.nsfw !== true && this.identifier(row.guild_id) === binding.guildId).slice(0, 25).map((row) => ({ id: this.requiredSnowflake(row.id, "channel"), guildId: binding.guildId, name: this.scalar(row.name, 100), type: 0, topic: this.scalar(row.topic, 1_024), position: this.number(row.position), nsfw: false }));
    return { channels, resultCount: channels.length, selectedGuildOnly: true, textChannelsOnly: true, nsfwExcluded: true, nextPageFollowed: false };
  }

  async listSelectedChannelMessages(token: string, binding: DiscordBinding) {
    this.binding(binding);
    const messages = this.array(await this.get(token, `/api/v10/channels/${binding.channelId}/messages?limit=25`, binding)).map((value) => this.object(value)).filter((row) => this.identifier(row.channel_id) === binding.channelId && typeof row.content === "string" && row.content.trim().length > 0).slice(0, 25).map((row) => ({ id: this.requiredSnowflake(row.id, "message"), channelId: binding.channelId, content: this.scalar(row.content, 4_000), timestamp: this.scalar(row.timestamp, 64), editedTimestamp: this.scalar(row.edited_timestamp, 64), type: this.number(row.type), authorsPeopleExcluded: true, mentionsRichContentExcluded: true }));
    return { messages, resultCount: messages.length, selectedGuildOnly: true, selectedChannelOnly: true, plainTextOnly: true, nextPageFollowed: false };
  }

  private async get(token: string, pathAndQuery: string, binding: DiscordBinding | null) {
    if (!token.trim()) throw new DiscordApiError("discord_token_invalid", "Discord bot token is missing.");
    if (binding) this.binding(binding);
    const url = new URL(pathAndQuery, ORIGIN);
    const allowed = url.pathname === "/api/v10/users/@me" && url.search === "" || binding !== null && (url.pathname === `/api/v10/guilds/${binding.guildId}` && url.search === "" || url.pathname === `/api/v10/guilds/${binding.guildId}/channels` && url.search === "" || url.pathname === `/api/v10/channels/${binding.channelId}/messages` && url.searchParams.get("limit") === "25" && [...url.searchParams.keys()].every((key) => key === "limit"));
    if (url.origin !== ORIGIN || !allowed) throw new DiscordApiError("discord_path_blocked", "Discord request is outside the fixed selected-guild/channel GET V1 allowlist.");
    let response: Response;
    try { response = await this.request(url.toString(), { method: "GET", headers: { Accept: "application/json", Authorization: `Bot ${token}` }, redirect: "error", signal: AbortSignal.timeout(30_000) }); }
    catch { throw new DiscordApiError("discord_unavailable", "Discord is temporarily unavailable."); }
    const raw = await response.text();
    if (raw.length > 1_000_000) throw new DiscordApiError("discord_response_too_large", "Discord response exceeded 1 MB.");
    let body: unknown = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { throw new DiscordApiError("discord_response_invalid", "Discord returned an invalid response."); }
    if (!response.ok) throw new DiscordApiError(response.status === 401 ? "discord_token_invalid" : response.status === 403 ? "discord_permission_denied" : response.status === 404 ? "discord_not_found" : response.status === 429 ? "discord_rate_limited" : "discord_api_error", "Discord request failed.", response.status);
    return body;
  }

  private binding(value: DiscordBinding) { if (!SNOWFLAKE.test(value.applicationId) || !SNOWFLAKE.test(value.guildId) || !SNOWFLAKE.test(value.channelId)) throw new DiscordApiError("discord_binding_invalid", "Discord requires exact application, selected-guild, and selected-channel snowflakes."); }
  private requiredSnowflake(value: unknown, noun: string) { const id = this.identifier(value); if (!id) throw new DiscordApiError("discord_response_invalid", `Discord returned an invalid ${noun} snowflake.`); return id; }
  private identifier(value: unknown) { return typeof value === "string" && SNOWFLAKE.test(value) ? value : null; }
  private object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
  private scalar(value: unknown, max: number): string | null { return typeof value === "string" ? value.slice(0, max) : null; }
  private number(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
}
