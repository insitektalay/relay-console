# Jotform MCP Errors

- Authentication failures require reconnecting the Jotform account.
- Insufficient scope requires reauthorization; do not ask for an API key.
- Schema failures mean the arguments do not match the live MCP schema.
- Provider validation failures do not prove that a form or submission was created.
- On an ambiguous write result, verify by ID or bounded listing before retrying.
