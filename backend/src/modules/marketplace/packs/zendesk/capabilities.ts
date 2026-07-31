import { capability } from "../../catalog/marketplace-catalog.types";

export const ZENDESK_CAPABILITIES = [
  capability("support_read", "Support Read", "Read Zendesk tickets, users, organizations, groups, agents, comments, attachments, tags, macros, triggers, automations, views, webhooks, and Help Center articles with bounded Support API queries.", true),
  capability("support_draft", "Support Draft", "Prepare Zendesk ticket comments, internal notes, requester/assignee/status/tag updates, macro/trigger plans, or Help Center changes without mutating Zendesk.", true),
  capability("support_write", "Support Write", "Create or update Zendesk tickets, comments, internal notes, users, organizations, tags, or assignments after validating subdomain, API token/OAuth scopes, role access, public/private visibility, and approval policy.", false),
  capability("support_admin", "Support Admin", "Manage Zendesk webhooks, triggers, automations, macros, groups, agent roles, Help Center publishing, exports, or destructive/bulk workflows only through explicit approval.", false),
];
