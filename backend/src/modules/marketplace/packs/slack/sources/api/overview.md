# Slack API Overview

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

## Provider Object Model

- Workspace/team: Slack team id, optional Enterprise Grid enterprise id, installed app id, bot user id, selected scopes, and token type.
- Conversation: public channel, private channel, MPIM, IM, or Slack Connect shared/external channel. Use `conversations.info` to confirm visibility, membership, archive state, and external sharing.
- Message: addressed by channel id plus `ts`; thread replies use `thread_ts`; edits and deletes preserve the original channel/message timestamp.
- User and bot user: resolve with `users.info`, `users.list`, or `users.lookupByEmail`; do not rely on display names.
- Reaction: attached to channel + message timestamp + reaction name; reactions are not durable approval records.
- File: file id, title/name, mimetype, shares, channels, and visibility.
- Event API envelope: `event_id`, `event.type`, `event_context`, `team_id`, `api_app_id`, `authorizations`, and nested event payload.

## Endpoint/Method Families

- Auth and installation: `auth.test`, OAuth V2 installation, and `apps.event.authorizations.list` where event authorization expansion is needed.
- Conversations: `conversations.list`, `conversations.info`, `conversations.history`, `conversations.replies`, `conversations.members`, `conversations.join`, and `conversations.open` where scopes and membership allow.
- Messages: `chat.postMessage`, `chat.update`, `chat.delete`, `chat.scheduleMessage`, and `chat.getPermalink`.
- Users: `users.info`, `users.list`, `users.lookupByEmail`.
- Reactions: `reactions.add`, `reactions.remove`, `reactions.get`.
- Files: `files.getUploadURLExternal`, `files.completeUploadExternal`, `files.info`.
- Collaboration surfaces: `pins.add`, `pins.remove`, bookmark methods where enabled, channel topic/purpose methods, and modal/app-home methods such as `views.open`, `views.update`, or `views.publish`.
- Events and interactivity: Events API `event_callback`, `app_mention`, message events, `reaction_added`, `file_shared`, slash commands, shortcuts, modals, and signed interaction payloads.
