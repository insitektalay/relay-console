# Jira Permissions and Scopes

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

## Provider Permission Model

Relevant permissions include read:jira-work, write:jira-work, read:jira-user, manage:jira-project. Project/admin and bulk-update permissions require approval.

## Capability Mapping

- Read capability: use Jira REST v3 issue, project, JQL search, transitions, comments, worklogs, fields, users/accountId, versions/components, boards, and sprints with bounded JQL.
- Draft capability: prepare exact Jira issue create/update, transition, comment, worklog, sprint, field, link, attachment, or webhook payloads without side effects.
- Write capability: create/update Jira issues, comments, worklogs, links, attachments, and transitions only when Atlassian scopes and project permissions allow it.
- Admin capability: Jira project configuration, workflows/statuses, fields/screens, permission schemes, webhook subscriptions, bulk changes, issue deletion/archive, and board/sprint administration; disabled by default.
