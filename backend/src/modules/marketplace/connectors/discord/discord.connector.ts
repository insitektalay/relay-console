import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const DISCORD_BOT_PERMISSIONS = "66560";

const reads = [
  action("discord_bot_get", "Get Relay bot", "Read the installed Relay bot's safe identity metadata."),
  action("discord_selected_guild_get", "Get selected guild", "Read safe metadata for the one administrator-selected Discord guild."),
  action("discord_selected_guild_channels_list", "List selected-guild channels", "Read up to twenty-five safe non-NSFW text-channel metadata records in the selected guild."),
  action("discord_selected_channel_messages_list", "List selected-channel messages", "Read up to twenty-five recent plain-text messages in the selected non-NSFW text channel."),
];

const blockedActions = [
  blocked("discord_user_account_automation", "Automate a user account", "Self-bots, user tokens, and acting as a Discord user are always blocked."),
  blocked("discord_dms_other_guilds_channels", "Access broader conversations", "DMs, other guilds or channels, threads, voice, stage, forum, media, and NSFW content are outside V1."),
  blocked("discord_people_presence_identities", "Access people data", "Authors, members, users, presence, emails, and other personal identity data are outside V1."),
  blocked("discord_mentions_media_reactions_polls", "Access rich message data", "Mentions, attachments, embeds, reactions, polls, components, snapshots, and other rich message data are excluded."),
  blocked("discord_search_writes_moderation_admin", "Search, change, or administer Discord", "Search, writes, deletes, moderation, roles, permissions, invites, audit logs, and administration are outside V1."),
  blocked("discord_commands_gateway_webhooks", "Use event or command surfaces", "Commands, interactions, Gateway connections, and webhooks are outside V1."),
  blocked("discord_pagination_raw", "Use broad or raw access", "Automatic pagination, raw provider requests, RPC, GraphQL, and MCP surfaces are outside V1."),
];

export const DISCORD_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "discord",
  name: "Discord",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.discord.com/developers/resources/message#get-channel-messages",
  providerWebsiteUrl: "https://discord.com/",
  capabilities: [
    { ...capability("bot_guild", "Read bot and selected guild", "Review safe identity and guild metadata for the installed Relay bot.", true), platformCapability: "discord_selected_guild_read" },
    { ...capability("selected_channels", "Read selected-guild channels", "Review up to twenty-five safe non-NSFW text channels in the selected guild.", true), platformCapability: "discord_selected_channels_read" },
    { ...capability("selected_messages", "Read selected-channel messages", "Review up to twenty-five recent plain-text messages in the selected channel.", true), platformCapability: "discord_selected_messages_read" },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      { name: "DISCORD_BOT_TOKEN", label: "Relay Discord bot token", required: true, secret: true, storedIn: "encrypted_secret", requiredForAuthTypes: ["api_key"], helpText: "Relay-owned bot token retained only by Railway." },
      { name: "DISCORD_APPLICATION_ID", label: "Discord application ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "Relay-owned Discord application snowflake." },
      { name: "DISCORD_SELECTED_GUILD_ID", label: "Selected guild ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "One administrator-verified guild snowflake." },
      { name: "DISCORD_SELECTED_CHANNEL_ID", label: "Selected channel ID", required: true, secret: false, storedIn: "metadata", requiredForAuthTypes: ["api_key"], helpText: "One verified non-NSFW text-channel snowflake in the selected guild." },
    ],
  },
  tools: [
    { name: "discord.getBot", functionName: "discord_bot_get", aliases: ["discord.getBot", "relay_discord_get_bot"], capability: "bot_guild", platformCapability: "discord_selected_guild_read", action: "read", approvalRequired: false, description: "Read the Relay bot's safe identity metadata.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "discord.getSelectedGuild", functionName: "discord_selected_guild_get", aliases: ["discord.getSelectedGuild", "relay_discord_get_selected_guild"], capability: "bot_guild", platformCapability: "discord_selected_guild_read", action: "read", approvalRequired: false, description: "Read safe metadata for the selected guild.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "discord.listSelectedGuildChannels", functionName: "discord_selected_guild_channels_list", aliases: ["discord.listSelectedGuildChannels", "relay_discord_list_selected_guild_channels"], capability: "selected_channels", platformCapability: "discord_selected_channels_read", action: "read", approvalRequired: false, description: "Read up to twenty-five safe non-NSFW text channels in the selected guild.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "discord.listSelectedChannelMessages", functionName: "discord_selected_channel_messages_list", aliases: ["discord.listSelectedChannelMessages", "relay_discord_list_selected_channel_messages"], capability: "selected_messages", platformCapability: "discord_selected_messages_read", action: "read", approvalRequired: false, description: "Read up to twenty-five recent plain-text messages in the selected channel.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  ],
  approvalProfiles: [
    { id: "discord_safe", label: "Safe", description: "Four fixed selected-guild/channel GET reads run automatically; user automation, broader conversations, people and rich message data, search, writes, administration, events, pagination, and raw access remain blocked.", defaultSelected: true, allowedActions: reads, approvalRequiredActions: [], blockedActions },
    { id: "dangerously_skip_permissions", label: "Dangerously skip permissions", description: "The same four reads run without per-action approval; exact bot permissions, selected-guild/channel containment, safe projections, limits, audit, and API controls still apply.", defaultSelected: false, allowedActions: reads, approvalRequiredActions: [], blockedActions },
  ],
  healthChecks: [{ id: "selected_channel", label: "Discord bot identity, selected guild, exact permissions 66560, selected non-NSFW text channel, and Message Content approval validation" }],
};
