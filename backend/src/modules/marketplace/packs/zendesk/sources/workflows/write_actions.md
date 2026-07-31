# Zendesk Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

1. Resolve ticket id, requester, assignee, group, organization, current status, tags, and comment visibility.
2. Draft the exact update JSON, including `public: false` for internal notes or `public: true` for approved public replies.
3. Require approval for public replies, lifecycle/assignment changes, bulk work, macros, triggers, automations, webhooks, roles, and Help Center publication.
4. Execute only approved payloads and report safe ticket id/status/comment id response data.
