import { capability } from "../../catalog/marketplace-catalog.types";

export const GMAIL_CAPABILITIES = [
  capability("read", "Read Gmail", "Read Gmail messages, threads, labels, history, attachments, headers, MIME parts, snippets, and raw/full/metadata formats with bounded Gmail queries.", true),
  capability("draft", "Draft Gmail", "Prepare exact Gmail MIME/raw drafts, replies, forwards, label mutations, message modifications, or watch requests without side effects.", true),
  capability("write", "Write Gmail", "Send approved Gmail drafts/messages, update labels, archive/trash selected messages, and manage drafts after Gmail OAuth scope and approval checks.", false),
  capability("admin", "Admin Gmail", "Operate Gmail push watch/stop, broad mailbox export, domain-wide delegated access, label deletion, irreversible delete, and high-risk mailbox settings under explicit approval.", false),
];
