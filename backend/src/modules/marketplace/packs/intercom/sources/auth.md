# Intercom Auth Setup

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

Relay uses its public Intercom OAuth app with only Read conversations and Read admins. Railway binds the grant to the exact workspace, US/EU/AU API origin, and verified authorizing admin returned by `/me`; tokens and client secrets never enter agent context.
