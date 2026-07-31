# Slack Permissions and Scopes

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

## Provider Permission Model

Typical read scopes include `channels:read`, `groups:read`, `im:read`, `mpim:read`, `users:read`, `files:read`, `reactions:read`, and channel-type-specific history scopes such as `channels:history`, `groups:history`, `im:history`, or `mpim:history`. Typical write scopes include `chat:write`, `chat:write.public`, `reactions:write`, `files:write`, `pins:write`, and `users:read.email` where email lookup is needed.

`conversations.history` and `conversations.replies` access depends on the channel type, selected history scopes, and whether the installed Slack app is a member of the conversation. Private channels, DMs, MPIMs, Slack Connect channels, and channels with restricted posting require explicit membership and approval-aware handling.

Slack permissions are installation-scoped. A request that works in one workspace or channel may fail in another because the Slack app was not installed, the bot was not invited to the channel, a user token lacks the matching user scope, or Enterprise Grid/Slack Connect policy blocks access.

## Capability Mapping

- Read capability: use `conversations.list`, `conversations.info`, `conversations.history`, `conversations.replies`, `users.info`, `users.list`, `files.info`, and reaction read methods to inspect Slack channels, threads, users, files, and message context available to the installed app.
- Draft capability: prepare exact `chat.postMessage`, `chat.update`, Block Kit, reaction, file-upload, or thread-reply payloads without posting.
- Write capability: post messages, replies, reactions, or file references only when the matching Slack scopes are selected and the active approval policy allows the target conversation.
- Admin capability: Slack app installation changes, Events API subscriptions, incoming webhook URLs, channel membership/topic/pin/bookmark changes, Slack Connect destinations, and destructive message operations; disabled by default.
