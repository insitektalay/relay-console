# Slack Escalation

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Escalate when credentials are missing, scopes are insufficient, provider ids are ambiguous, the operation is approval-required, the request touches secrets or high-risk data, the provider returns conflicting state, or official docs do not cover the requested action.

## Approval-Required Patterns

- Posting to @channel, @here, large public channels, executive channels, incident channels, shared/external channels, or customer-visible Slack Connect channels requires approval.
- Adding/removing files, pins, bookmarks, channel topics, channel membership, webhooks, or event subscriptions requires approval.
- Deleting or updating existing messages requires approval unless the message is the agent draft in the same workflow.
- Scope expansion, app reinstall, use of `chat:write.public`, incoming webhook changes, signing-secret rotation, and Socket Mode changes require approval.

## Blocked Patterns

- Exposing bot tokens, user tokens, signing secrets, app-level tokens, webhook URLs, or Slack export archives is blocked.
- Mass DM, spam, workspace deletion, bypassing retention/legal hold, and broad private-channel export are blocked.
- Do not invite external users, create public announcements, or use mention-broadcasts to pressure users without approval.
- Do not treat emoji reactions as approval for financial, security, production, legal, or customer-impacting actions.
