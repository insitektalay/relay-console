# Jira Workflow Router

Use Jira for work-management operations involving issues, projects, boards, sprints, comments, transitions, worklog, JQL.

Do not use Jira for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.

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

## Routing Doctrine

1. Confirm the connected Jira Cloud site, project key, issue key, board/sprint context, JQL filter, workflow transition id, account id, and Atlassian OAuth/API-token scope before selecting tools.
2. Load auth, permissions, endpoint, rate-limit, webhook, error, safe-action, and workflow references before writes.
3. Resolve Jira issue ids/keys, project ids/keys, board ids, sprint ids, transition ids, status ids, field ids, accountIds, version/component ids, worklog ids, and webhook ids from Jira APIs before mutating anything.
4. Draft bulk issue transitions, issue deletes/archives, project/workflow/status/field changes, sprint changes, customer-visible comments, worklog changes, webhook changes, and permission-impacting operations for approval.
5. Record Jira site, project key, issue key/id, JQL, transition id, changed fields, approval id, and safe response summaries after approved writes.

## When To Use

Use Jira for work-management operations involving issues, projects, boards, sprints, comments, transitions, worklog, JQL.

## When Not To Use

Do not use Jira for source-code edits, billing, chat broadcasts, or documents that belong in a knowledge base unless linked to work items.
