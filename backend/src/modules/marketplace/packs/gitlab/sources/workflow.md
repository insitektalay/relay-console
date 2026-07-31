# GitLab Workflow Router

Use GitLab for developer operations involving projects, repository, branches, commits, merge_requests, issues, pipelines, jobs, webhooks.

Do not use GitLab for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.

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

## Routing Doctrine

1. Confirm the connected GitLab host, group/project id, repository path, branch, issue/MR/pipeline ids, token scopes, protected environment status, and webhook target before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve GitLab group ids, project ids/paths, branch names, commit SHAs, merge request IIDs, issue IIDs, pipeline/job ids, environment names, protected branch/tag ids, variable keys, and webhook ids before mutating anything.
4. Draft merge request actions, branch/tag protection changes, repository file writes, pipeline triggers/retries/cancels, environment deployments, CI/CD variable changes, project/group membership changes, webhook changes, and destructive project/repository operations for approval.
5. Record GitLab host, group/project id or path, branch/ref, SHA, MR/issue/pipeline/job ids, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use GitLab for developer operations involving projects, repository, branches, commits, merge_requests, issues, pipelines, jobs, webhooks.

## When Not To Use

Do not use GitLab for unrelated CRM, email, or payment workflows. Production deploy/configuration changes require explicit approval.
