# Slack Safe Actions

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Allowed Without Additional Approval

- For summaries, resolve the channel id, verify channel visibility and membership, call conversations.history with a bounded oldest/latest window, then fetch thread replies only for messages the user asks about.
- For a user mention or assignee, use users.info or users.lookupByEmail only when selected scopes allow it; do not infer identity from display names alone.
- For file context, inspect files.info and message shares; do not download private files unless the user explicitly requested that file and capability is enabled.
- Draft Slack messages, Block Kit payloads, and thread replies without posting. Include the channel id, message text, `thread_ts`, unfurl settings, and mention behavior in the draft.

## Approval Required

- Posting to @channel, @here, large public channels, executive channels, incident channels, shared/external channels, or customer-visible Slack Connect channels requires approval.
- Adding/removing files, pins, bookmarks, channel topics, channel membership, webhooks, or event subscriptions requires approval.
- Deleting or updating existing messages requires approval unless the message is the agent draft in the same workflow.
- Using `chat.postMessage` with `chat:write.public`, posting into channels where the bot was not previously invited, changing app scopes, reinstalling the app, rotating signing secrets, or changing incoming webhook destinations requires approval.

## Blocked

- Exposing bot tokens, user tokens, signing secrets, app-level tokens, webhook URLs, or Slack export archives is blocked.
- Mass DM, spam, workspace deletion, bypassing retention/legal hold, and broad private-channel export are blocked.
- Do not invite external users, create public announcements, or use mention-broadcasts to pressure users without approval.
- Do not impersonate a user, fabricate approval from a reaction, scrape private channels outside the installed app's access, or use Slack as a credential exchange channel.

## Secret-Safety Rule

Provider secrets and credential-shaped values must never appear in responses, generated files, examples, audit notes, or provider-side comments/messages.
