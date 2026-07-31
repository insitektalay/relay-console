import { action, blocked } from "../../catalog/marketplace-catalog.types";

const reads = [
  action(
    "intercom_conversation_count",
    "Read conversation count",
    "Read the workspace conversation count.",
  ),
  action(
    "intercom_conversation_list",
    "List conversations",
    "List at most twenty-five privacy-redacted conversation metadata summaries.",
  ),
  action(
    "intercom_conversation_get",
    "Read conversation metadata",
    "Read one exact privacy-redacted conversation metadata summary.",
  ),
];

const blockedActions = [
  blocked(
    "intercom_conversation_mutation",
    "Change conversations",
    "Replies, notes, assignment, state, priority, and deletion changes are outside V1.",
  ),
  blocked(
    "intercom_private_content",
    "Read private support content",
    "Messages, subjects, parts, contacts, teammates, attachments, tags, and attributes are outside V1.",
  ),
  blocked(
    "intercom_broader_workspace",
    "Access broader workspace data",
    "Contacts, companies, tickets, admins, teams, articles, webhooks, Fin, reports, settings, and other products are outside V1.",
  ),
  blocked(
    "intercom_raw_search",
    "Run arbitrary searches",
    "Search, arbitrary filters, cursors, raw responses, and custom requests are outside V1.",
  ),
  blocked(
    "intercom_bulk_export",
    "Export Intercom data",
    "Pagination, crawling, bulk operations, and exports are outside V1.",
  ),
];

export const INTERCOM_APPROVAL_PROFILES = [
  {
    id: "intercom_safe",
    label: "Safe",
    description: "All three bounded metadata reads require matching approval.",
    defaultSelected: true,
    allowedActions: [],
    approvalRequiredActions: reads,
    blockedActions,
  },
  {
    id: "dangerously_skip_permissions",
    label: "Dangerously skip permissions",
    description:
      "Selected metadata reads run without Relay per-action approval; exact authority, provider permissions, redaction, limits, audit, and revocation remain enforced.",
    defaultSelected: false,
    allowedActions: reads,
    approvalRequiredActions: [],
    blockedActions,
  },
];
