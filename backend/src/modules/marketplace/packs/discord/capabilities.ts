import { capability } from "../../catalog/marketplace-catalog.types";

export const DISCORD_CAPABILITIES = [
  capability("guild_channel_read", "Guild and Channel Reads", "Read guild, channel, thread, role and permission state visible to the bot/user.", true),
  capability("message_read", "Messages Read", "Read and summarize messages, threads, pins and reactions within granted channel permissions.", true),
  capability("draft_responses", "Draft Responses", "Draft public replies, announcements, slash-command responses and moderation notes.", true),
  capability("message_write", "Message Writes", "Send/edit/delete messages or webhook posts after approval when public or mention-heavy.", false),
  capability("moderation_admin", "Moderation and Admin", "Roles, permissions, webhooks, bans, timeouts, kicks and application-command changes require approval.", false),
];
