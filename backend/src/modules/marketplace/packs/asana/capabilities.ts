import { capability } from "../../catalog/marketplace-catalog.types";

export const ASANA_CAPABILITIES = [
  capability("read", "Read Asana", "Read Asana tasks, projects, sections, stories, workspaces, teams, users, custom fields, portfolios, attachments, and webhooks with bounded pagination.", true),
  capability("draft", "Draft Asana", "Prepare exact Asana task create/update, project/section membership, story/comment, custom-field, portfolio, attachment, or webhook payloads without side effects.", true),
  capability("write", "Write Asana", "Create/update Asana tasks, stories, memberships, sections, attachments, and custom-field values after OAuth/PAT access and approval checks.", false),
  capability("admin", "Admin Asana", "Operate Asana workspace/project deletion, custom-field/schema changes, team/project permissions, portfolio configuration, webhooks, and bulk destructive operations under approval.", false),
];
