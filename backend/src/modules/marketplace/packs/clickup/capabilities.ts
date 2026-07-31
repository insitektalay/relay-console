import { capability } from "../../catalog/marketplace-catalog.types";

export const CLICKUP_CAPABILITIES = [
  capability("read", "Read ClickUp", "Read ClickUp teams/workspaces, spaces, folders, lists, tasks, statuses, custom fields, comments, docs, users, goals, views, and webhooks with bounded filters.", true),
  capability("draft", "Draft ClickUp", "Prepare exact ClickUp task create/update, list/space/folder, status, custom-field, assignee, comment, doc, attachment, or webhook payloads without side effects.", true),
  capability("write", "Write ClickUp", "Create/update ClickUp tasks, comments, statuses, assignees, priorities, dates, tags, docs, and custom fields after token access and approval checks.", false),
  capability("admin", "Admin ClickUp", "Operate ClickUp workspace/team configuration, spaces/folders/lists, statuses, custom fields, permissions, docs, webhooks, automations, and bulk/destructive operations under approval.", false),
];
