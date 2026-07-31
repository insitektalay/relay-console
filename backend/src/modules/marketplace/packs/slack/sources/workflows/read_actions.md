# Slack Read Workflows

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

- For summaries, resolve the channel id, verify channel visibility and membership, call conversations.history with a bounded oldest/latest window, then fetch thread replies only for messages the user asks about.
- For a user mention or assignee, use users.info or users.lookupByEmail only when selected scopes allow it; do not infer identity from display names alone.
- For file context, inspect files.info and message shares; do not download private files unless the user explicitly requested that file and capability is enabled.
- For thread summaries, read the parent message with `conversations.history`, then call `conversations.replies` using the exact channel id and parent `ts`; preserve author ids and timestamps in the audit note.
- For Slack Connect or private-channel summaries, minimize quoted content and confirm the user is allowed to receive the summary.

Always use explicit Slack ids or narrow Slack search filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private-channel data.
