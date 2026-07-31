# Slack Write Workflows

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

- Draft the exact chat.postMessage payload including channel id, text, blocks, thread_ts, unfurl settings, and whether link_names could notify people.
- Use chat.postMessage only after confirming target channel and approval state for announcements, external channels, @channel/@here, or Slack Connect destinations.
- Use reactions.add/remove only for narrow acknowledgement workflows; never use reactions as hidden approval signals for financial, security, or production changes.
- For a thread reply, include `thread_ts` and confirm whether the reply should broadcast to the channel. Channel broadcast from a thread requires approval when it reaches a broad or external audience.
- For message edits/deletes, read the original message first, show the exact `chat.update` or `chat.delete` target, and require approval unless replacing an unsent draft from the same workflow.
- For file uploads, show file name, destination channel, Slack Connect status, and visibility impact before calling file upload methods.

Before execution, show the target Slack workspace/team, channel/conversation id, message `ts` or `thread_ts`, changed fields, external/customer impact, rollback expectations, approval requirement, and audit note.
