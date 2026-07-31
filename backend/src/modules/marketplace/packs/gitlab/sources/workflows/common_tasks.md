# GitLab Common Workflows

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

- Resolve GitLab host, group/project id or path, branch/ref, MR IID, issue IID, pipeline/job id, and environment before querying.
- Inspect current deployment/pipeline/issue/event/config state before proposing action.
- Limit logs/events to the requested time window and redact secrets.
- Draft exact create/update payloads for issues, configs, deployments, flags, or webhooks.
- Use preview/sandbox workflows when possible.
- Audit every production or customer-impacting mutation.
