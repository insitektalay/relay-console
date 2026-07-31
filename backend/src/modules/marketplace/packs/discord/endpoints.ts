export const DISCORD_ENDPOINT_FAMILIES = [
  {
    id: "applications",
    label: "Applications and Interactions",
    docsUrl: "https://docs.discord.com/developers/platform/oauth2-and-permissions",
    guidance: "Slash command and interaction changes affect app behavior and require approval.",
    representativeEndpoints: ["GET /applications/{application.id}/commands","POST /interactions/{interaction.id}/{interaction.token}/callback"],
  },
  {
    id: "guilds",
    label: "Guilds, Members and Roles",
    docsUrl: "https://docs.discord.com/developers/platform/oauth2-and-permissions",
    guidance: "Role hierarchy and permissions must be checked before member/admin actions.",
    representativeEndpoints: ["GET /guilds/{guild.id}","GET /guilds/{guild.id}/members","PATCH /guilds/{guild.id}/roles/{role.id}"],
  },
  {
    id: "channels",
    label: "Channels, Threads and Messages",
    docsUrl: "https://docs.discord.com/developers/platform/oauth2-and-permissions",
    guidance: "Public posts, mentions and deletes are approval-gated.",
    representativeEndpoints: ["GET /channels/{channel.id}","GET /channels/{channel.id}/messages","POST /channels/{channel.id}/messages"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    docsUrl: "https://docs.discord.com/developers/platform/oauth2-and-permissions",
    guidance: "Webhook URLs are secrets and create external posting capability.",
    representativeEndpoints: ["GET /channels/{channel.id}/webhooks","POST /channels/{channel.id}/webhooks","POST /webhooks/{webhook.id}/{webhook.token}"],
  },
  {
    id: "gateway",
    label: "Gateway and Events",
    docsUrl: "https://docs.discord.com/developers/platform/oauth2-and-permissions",
    guidance: "Use intents narrowly; privileged intents need explicit justification.",
    representativeEndpoints: ["GET /gateway/bot","Gateway Identify","Gateway Dispatch events"],
  },
  {
    id: "moderation",
    label: "Moderation",
    docsUrl: "https://docs.discord.com/developers/platform/oauth2-and-permissions",
    guidance: "Timeouts, bans, kicks and bulk deletes require approval.",
    representativeEndpoints: ["PUT /guilds/{guild.id}/bans/{user.id}","PATCH /guilds/{guild.id}/members/{user.id}","POST /channels/{channel.id}/messages/bulk-delete"],
  },
];
