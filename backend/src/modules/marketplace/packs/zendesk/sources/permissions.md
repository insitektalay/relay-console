# Zendesk Permissions and Scopes

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Zendesk authorization depends on API token/OAuth grant plus the authenticated user's role, group membership, ticket access, organization access, and product plan. End users see only public comments and allowed request fields; agents may see internal notes and administrative metadata.

Validate role and visibility before reading or drafting ticket comments. Macro, trigger, automation, webhook, group, role, routing, and Help Center changes are administrative and approval-required.
