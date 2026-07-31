# Slack Endpoint Families

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

- Auth and installation: `auth.test`, OAuth V2 installation, and `apps.event.authorizations.list` where event authorization expansion is needed.
- Conversations: `conversations.list`, `conversations.info`, `conversations.history`, `conversations.replies`, `conversations.members`, `conversations.join`, and `conversations.open` where scopes and channel type allow.
- Messages: `chat.postMessage`, `chat.update`, `chat.delete`, `chat.scheduleMessage`, `chat.getPermalink`, and response payload handling for `channel`, `ts`, and `message`.
- Users: `users.info`, `users.list`, `users.lookupByEmail` with `users:read` or `users:read.email` as required.
- Reactions: `reactions.add`, `reactions.remove`, `reactions.get`.
- Files: `files.getUploadURLExternal`, `files.completeUploadExternal`, `files.info`, and file-share metadata; avoid legacy uploads if the connector supports the external upload flow.
- Collaboration surfaces: `pins.add`, `pins.remove`, bookmark methods where enabled, channel topic/purpose methods where available, and modal/app-home methods such as `views.open`, `views.update`, or `views.publish` only for approved app UX workflows.

## Read Method Doctrine

- For summaries, resolve the channel id, verify channel visibility and membership, call conversations.history with a bounded oldest/latest window, then fetch thread replies only for messages the user asks about.
- For a user mention or assignee, use users.info or users.lookupByEmail only when selected scopes allow it; do not infer identity from display names alone.
- For file context, inspect files.info and message shares; do not download private files unless the user explicitly requested that file and capability is enabled.

## Write Method Doctrine

- Draft the exact chat.postMessage payload including channel id, text, blocks, thread_ts, unfurl settings, and whether link_names could notify people.
- Use chat.postMessage only after confirming target channel and approval state for announcements, external channels, @channel/@here, or Slack Connect destinations.
- Use reactions.add/remove only for narrow acknowledgement workflows; never use reactions as hidden approval signals for financial, security, or production changes.
- For file uploads, request/upload/complete the external upload flow, then verify file visibility and shares before summarizing. Do not upload customer, security, or incident files to Slack Connect channels without approval.
