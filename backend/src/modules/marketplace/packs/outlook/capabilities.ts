import { capability } from "../../catalog/marketplace-catalog.types";

export const OUTLOOK_CAPABILITIES = [
  capability("read", "Read Outlook", "Read Outlook/Microsoft Graph messages, conversations, mail folders, attachments, headers, internetMessageId, categories, body previews, and change notifications with bounded queries.", true),
  capability("draft", "Draft Outlook", "Prepare exact Outlook/Graph message JSON or MIME drafts, sendMail, reply/replyAll/forward, move, attachment, category, or subscription payloads without side effects.", true),
  capability("write", "Write Outlook", "Send approved Outlook mail, update/move/delete selected messages, manage drafts, and apply folders/categories after Graph permission and approval checks.", false),
  capability("admin", "Admin Outlook", "Operate application-wide mailbox access, shared/delegated mailboxes, mailbox rules/settings, broad export, irreversible delete, and Graph subscriptions under explicit approval.", false),
];
