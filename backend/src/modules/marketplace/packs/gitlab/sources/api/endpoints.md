# GitLab Endpoint Families

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

- `GET /projects`, `GET /groups`, project lookup by id/path, members, protected branches/tags, variables, and deploy keys/tokens.
- Repository endpoints for branches, commits, tags, tree, blobs, and `repository/files`.
- Issues, issue notes, merge requests, MR notes, approvals, discussions, and award emoji endpoints.
- Pipelines, jobs, environments, deployments, releases, and pipeline trigger endpoints.
- Project/group hooks endpoints for webhooks and event subscriptions.

## Read Method Doctrine

- Resolve GitLab host, group/project id or path, branch/ref, MR IID, issue IID, pipeline/job id, and environment before querying.
- Inspect current branch protection, MR state, pipeline/job state, issue labels/assignee/milestone, environment status, and variable metadata before proposing action.
- Limit logs/jobs/events to the requested time window and redact CI variables, tokens, deploy keys, and secrets.

## Write Method Doctrine

- Draft exact GitLab issue, merge request, note, branch/tag, repository file, pipeline/job, environment, CI/CD variable, member, or webhook payloads.
- Use non-protected branches, draft MRs, or staging environments when possible.
- Audit every protected branch, production environment, CI/CD variable, webhook, membership, or customer-impacting mutation.
