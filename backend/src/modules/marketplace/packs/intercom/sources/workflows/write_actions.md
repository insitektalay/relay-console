# Intercom Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

1. Resolve target ids and classify the write as note, customer-visible reply, assignment/state, contact/company, tag/segment, article, webhook/admin, bulk/export, or destructive.
2. Draft exact JSON and state whether the user/customer will see it.
3. Require approval for customer-visible replies, outbound messages, bulk work, routing changes, articles, webhooks, and admin/team changes.
4. Execute only approved payloads and report safe ids/status.
