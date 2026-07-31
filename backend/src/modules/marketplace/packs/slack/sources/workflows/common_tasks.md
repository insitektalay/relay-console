# Slack Common Workflows

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
- Draft the exact chat.postMessage payload including channel id, text, blocks, thread_ts, unfurl settings, and whether link_names could notify people.
- Use chat.postMessage only after confirming target channel and approval state for announcements, external channels, @channel/@here, or Slack Connect destinations.
- Use reactions.add/remove only for narrow acknowledgement workflows; never use reactions as hidden approval signals for financial, security, or production changes.
- For a Slack Connect channel, identify the internal workspace/team, external organization visibility, and customer-facing risk before reading or posting.
- For Event API work, verify request signatures, de-duplicate event_id values, and avoid responding to bot-authored messages unless the workflow explicitly allows it.
