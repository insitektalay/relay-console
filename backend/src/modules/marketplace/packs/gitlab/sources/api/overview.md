# GitLab API Overview

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

## Provider Object Model

- projects
- repository
- branches
- commits
- merge_requests
- issues
- pipelines
- jobs
- webhooks

## Endpoint/Method Families

- GET /projects
- GET /projects/:id/repository/files
- GET/POST issues
- GET/POST merge_requests
- pipeline/job endpoints
- hooks endpoints
