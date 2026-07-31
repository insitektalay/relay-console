# Slack Object Model

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://api.slack.com/web
- https://api.slack.com/authentication/oauth-v2
- https://api.slack.com/scopes
- https://api.slack.com/methods/conversations.history
- https://api.slack.com/methods/conversations.replies
- https://api.slack.com/methods/chat.postMessage
- https://api.slack.com/methods/users.info
- https://api.slack.com/apis/connections/events-api
- https://api.slack.com/apis/rate-limits
- https://api.slack.com/errors

- Workspace/team: Slack team id, optional Enterprise Grid enterprise id, installed app id, bot user id, selected scopes, and token type.
- Conversation: public channel, private channel, MPIM, IM, or Slack Connect shared/external channel. Use the conversation id prefix and `conversations.info` fields to confirm visibility, membership, archive state, and external sharing.
- Message: addressed by channel id plus `ts`. Thread replies use `thread_ts`; message edits/deletes must preserve the original `ts`, author/bot identity, and target channel.
- User and bot user: resolve with `users.info`, `users.list`, or `users.lookupByEmail`; do not rely on display names for identity.
- Reaction: attached to channel + message timestamp + reaction name; reactions are not durable approval records.
- File: file id, title/name, mimetype, shares, channels, and visibility. File downloads/uploads can expose private Slack content.
- Event API envelope: `event_id`, `event.type`, `event_context`, `team_id`, `api_app_id`, `authorizations`, and nested event payload.
- Message composition: plain `text`, Block Kit `blocks`, attachments where supported, unfurl settings, `link_names`, and mention tokens such as `<@U...>` or `<!here>`.
