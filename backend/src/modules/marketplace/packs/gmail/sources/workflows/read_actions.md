# Gmail Read Workflows

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developers.google.com/gmail/api/guides
- https://developers.google.com/gmail/api/auth/about-auth
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/workspace/gmail/api/reference/rest
- https://developers.google.com/gmail/api/guides/push
- https://developers.google.com/workspace/gmail/api/guides/handle-errors

- Search with Gmail `q` syntax, `labelIds`, and a narrow time/window limit.
- Read thread/message metadata before fetching full body or attachments.
- Summarize mail without exposing tokens, auth links, or unnecessary personal data.

Always use explicit Gmail message ids, thread ids, label ids, history ids, attachment ids, or narrow Gmail `q` search filters. Summaries must redact secrets, auth links, one-time codes, and unnecessary personal, customer, financial, security, source-code, or private mailbox data.
