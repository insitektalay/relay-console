# Jira API Overview

{{CONNECTION_CONTEXT}}

{{CAPABILITY_CONTEXT}}

{{POLICY_CONTEXT}}

## Official Documentation URLs

- https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
- https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-jira/
- https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/
- https://developer.atlassian.com/cloud/jira/platform/rate-limiting/
- https://developer.atlassian.com/cloud/jira/platform/webhooks/

## Provider Object Model

- issues
- projects
- boards
- sprints
- comments
- transitions
- worklog
- JQL

## Endpoint/Method Families

- GET /rest/api/3/search/jql
- GET/POST /rest/api/3/issue
- POST /issue/{id}/transitions
- POST /issue/{id}/comment
- GET/POST worklog
- Agile board/sprint endpoints
