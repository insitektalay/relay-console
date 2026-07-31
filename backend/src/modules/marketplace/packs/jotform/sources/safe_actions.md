# Jotform Safe Actions

{{POLICY_CONTEXT}}

- Reads may run directly when the read capability is selected.
- Treat every form creation, form edit, and submission creation as an external write.
- Do not request approval until the exact MCP tool name and complete arguments pass local schema validation.
- Do not retry a rejected write with guessed argument shapes.
- Verify returned form or submission IDs through an allowed read before reporting completion.
