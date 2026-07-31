# Jira Read Workflows

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

- Resolve Jira Cloud site, project key, issue key/id, board id, sprint id, and accountId before querying.
- Read current status/state/assignee/labels before proposing changes.
- Use bounded JQL for reports and preserve Jira issue keys, ids, and field ids.

Always use explicit Jira Cloud site, project keys, issue keys/ids, board ids, sprint ids, transition ids, field ids, accountIds, or bounded JQL filters. Summaries must redact secrets and unnecessary personal, customer, financial, security, source-code, or private issue data.
