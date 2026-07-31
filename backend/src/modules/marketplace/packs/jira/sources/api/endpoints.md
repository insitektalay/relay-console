# Jira Endpoint Families

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

- `GET /rest/api/3/search/jql` with bounded JQL, fields, pagination, and expansion.
- `GET/POST /rest/api/3/issue`, issue update, editmeta/createmeta, attachments, issue links, versions, and components.
- `GET /rest/api/3/issue/{issueIdOrKey}/transitions` and `POST /issue/{id}/transitions`.
- `GET/POST /issue/{id}/comment` and comment update/delete.
- `GET/POST /issue/{id}/worklog` for work logging.
- Jira Software Agile board/sprint endpoints for board context, sprint state, and sprint membership.
- Jira webhook endpoints for project/issue events.

## Read Method Doctrine

- Resolve Jira Cloud site, project key, issue key/id, board id, sprint id, and accountId before querying.
- Read current status, valid transitions, assignee, labels, fields, components, versions, and permissions before proposing changes.
- Use bounded JQL for reports and preserve issue keys, ids, and field ids.

## Write Method Doctrine

- Create issues with explicit project key/id, issue type, summary, description, priority, labels, components, versions, assignee accountId, and required custom fields.
- Transition issues only after confirming the transition id is valid for that issue workflow.
- Add comments/worklogs with clear source context; never use comments as hidden approval records.
