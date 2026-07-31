import { capability } from "../../catalog/marketplace-catalog.types";

export const JIRA_CAPABILITIES = [
  capability("read", "Read Jira", "Read Jira issues, projects, JQL search results, transitions, comments, worklogs, fields, accountIds, boards, sprints, versions, components, and webhooks with bounded queries.", true),
  capability("draft", "Draft Jira", "Prepare exact Jira issue create/update, transition, comment, worklog, sprint, field, issue-link, attachment, or webhook payloads without side effects.", true),
  capability("write", "Write Jira", "Create/update Jira issues, comments, worklogs, links, attachments, and transitions after Atlassian scope, project permission, and approval checks.", false),
  capability("admin", "Admin Jira", "Operate Jira project configuration, workflows/statuses, fields/screens, permission schemes, webhooks, bulk changes, deletion/archive, boards, and sprints under explicit approval.", false),
];
