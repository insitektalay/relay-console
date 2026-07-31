# Slack Workflow Router

Use Slack for team-channel operations: summarizing public, private, shared, or external-channel conversations; drafting announcements; posting approved operational updates with chat.postMessage; reading thread context with conversations.history and conversations.replies; resolving user identity with users.info; and coordinating reactions, files, or mentions when selected scopes allow it.

Do not use Slack for durable project records that belong in an issue tracker, regulated customer support records, secrets exchange, broad workspace administration, or any request to mass-message users, use @channel/@here without approval, or expose private-channel/shared-channel data outside its intended audience.

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

## Routing Doctrine

1. Confirm the connected Slack workspace/team, installed Slack app, bot-token or user-token context, and target conversation id before selecting tools.
2. Classify the destination as public channel, private channel, MPIM, IM, or Slack Connect shared/external channel. Treat Slack Connect and customer-visible channels as approval-required destinations.
3. Resolve user ids, bot ids, channel ids, message `ts`, and thread `thread_ts` with Slack read methods before constructing writes.
4. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before `chat.*`, `reactions.*`, `files.*`, `pins.*`, bookmark, topic, membership, or Events API changes.
5. Draft @channel/@here announcements, Slack Connect posts, message deletions/updates, file uploads, app-installation changes, Events API subscriptions, incoming webhook usage, and bulk channel/member operations for approval.
6. Record Slack ids, target channel/conversation, message timestamp, approval id, and safe response summaries after approved writes.

## When To Use

Use Slack for team-channel operations: summarizing public, private, shared, or external-channel conversations; drafting announcements; posting approved operational updates with chat.postMessage; reading thread context with conversations.history and conversations.replies; resolving user identity with users.info; and coordinating reactions, files, or mentions when selected scopes allow it.

## When Not To Use

Do not use Slack for durable project records that belong in an issue tracker, regulated customer support records, secrets exchange, broad workspace administration, or any request to mass-message users, use @channel/@here without approval, or expose private-channel/shared-channel data outside its intended audience.
