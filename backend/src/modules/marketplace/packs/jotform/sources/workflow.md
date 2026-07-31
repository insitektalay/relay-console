# Jotform Workflow Router

Use only Relay's bounded `jotform_read` and `jotform_manage` wrappers for Jotform's official hosted MCP server.

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Required routing

1. Use `form_list` and `get_submissions` for reads.
2. Use `create_form`, `edit_form`, and `create_submission` for writes.
3. Never invent REST operation names, endpoints, flattened field syntax, or a raw JSON alternative.
4. Use the exact live MCP input schema returned by Relay.
5. Prepare the final tool name and arguments before asking for approval.
6. After approval, execute the identical tool name and arguments. Any change requires a new approval.
7. Verify a successful write with a read and report provider IDs; never infer success from approval alone.

Official references:

- https://www.jotform.com/help/how-to-use-jotform-mcp-server/
- https://mcp.jotform.com/.well-known/oauth-protected-resource/mcp
- https://oauth2.jotform.com/.well-known/oauth-authorization-server
