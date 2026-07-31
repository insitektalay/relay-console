# GitLab Permissions and Scopes

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

## Provider Permission Model

Relevant permissions include api, read_api, read_repository, write_repository, read_user. Production, environment, secret, deploy, and admin permissions are high-risk.

## Capability Mapping

- Read capability: use GitLab projects, groups, repository files/branches/commits, issues, merge requests, pipelines, jobs, environments, releases, variables metadata, and webhooks with bounded queries.
- Draft capability: prepare exact GitLab issue, merge request, branch/tag, repository file, pipeline/job, environment, CI/CD variable, member, or webhook payloads without side effects.
- Write capability: create/update GitLab issues, merge requests, comments, branches/tags, pipeline actions, and limited repository file changes only when token scopes and project permissions allow it.
- Admin capability: GitLab protected refs, CI/CD variables/secrets, project/group membership, webhooks, deploy tokens/keys, project deletion/archive, pipeline cancellation, production environment operations, and destructive repository changes; disabled by default.
