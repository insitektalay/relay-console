# Jotform Authentication

Relay owns the OAuth client flow and connects to `https://mcp.jotform.com/mcp` with S256 PKCE.

{{CONNECTION_CONTEXT}}

- The normal connection uses Jotform's `full` OAuth scope so selected write capabilities can work.
- Access and refresh tokens stay encrypted on Railway and must never appear in prompts, arguments, docs, or results.
- Do not ask the user to create an API key for a normal connection.
- An existing legacy API-key connection may continue to work, but it is not the setup path for a new connection.
