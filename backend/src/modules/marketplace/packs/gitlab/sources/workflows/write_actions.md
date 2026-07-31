# GitLab Write Workflows

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

- Draft exact create/update payloads for issues, configs, deployments, flags, or webhooks.
- Use preview/sandbox workflows when possible.
- Audit every production or customer-impacting mutation.

Before execution, show the GitLab host, project/group id or path, branch/ref, commit SHA, issue/MR/pipeline/job ids, changed fields, production/customer impact, rollback expectations, approval requirement, and audit note.
