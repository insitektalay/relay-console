# GitLab API Authentication

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://docs.gitlab.com/api/rest/
- https://docs.gitlab.com/api/rest/authentication/
- https://docs.gitlab.com/user/profile/personal_access_tokens/#personal-access-token-scopes
- https://docs.gitlab.com/api/projects/
- https://docs.gitlab.com/security/rate_limits/
- https://docs.gitlab.com/user/project/integrations/webhooks/

OAuth token, personal access token, project access token, or group access token. Tokens/secrets remain in ClawChat connections.

Use connector-held GitLab OAuth tokens, project/group access tokens, or personal access tokens for the target GitLab host. Confirm scopes such as `read_api`, `api`, `read_repository`, `write_repository`, or CI/CD permissions before selecting endpoints. Do not infer missing GitLab credentials from user text; if token scope or project membership is insufficient, ask the user to repair the GitLab connection.
