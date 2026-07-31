# HubSpot Write Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

1. Resolve target record ids, property internal names, owner ids, pipeline/stage ids, status values, and association type ids.
2. Build the exact payload and classify impact: internal-only, customer-visible, pipeline/lifecycle, bulk/export, automation/webhook/admin, or destructive.
3. For approval-required actions, show target ids, changed fields, customer impact, count, rollback expectations, and approval id before execution.
4. Execute only the approved payload. For batch endpoints, keep batch size and retry behavior bounded.
5. Report safe response status, object ids, and changed fields without exposing secrets or full customer exports.
