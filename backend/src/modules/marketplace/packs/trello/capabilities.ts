import { capability } from "../../catalog/marketplace-catalog.types";

export const TRELLO_CAPABILITIES = [
  capability("read", "Read Trello", "Read Trello boards, lists, cards, checklists, checkItems, members, labels, actions, attachments, custom fields, and webhooks with bounded queries.", true),
  capability("draft", "Draft Trello", "Prepare exact Trello card create/update/move/archive, checklist/checkItem, comment/action, label/member, attachment, custom-field, board/list, or webhook payloads without side effects.", true),
  capability("write", "Write Trello", "Create/update/move Trello cards, comments, labels, checklists, attachments, and list membership after token access and approval checks.", false),
  capability("admin", "Admin Trello", "Operate Trello board closure/deletion, workspace/board permissions, webhooks, power-up/custom-field configuration, bulk card moves, and destructive operations under approval.", false),
];
