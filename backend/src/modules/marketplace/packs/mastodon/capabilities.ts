import { capability } from "../../catalog/marketplace-catalog.types";

export const MASTODON_CAPABILITIES = [
  capability("read", "Read Mastodon", "Read timelines, statuses, notifications, accounts, media metadata, and reports where instance scopes permit it.", true),
  capability("draft", "Draft Mastodon", "Draft statuses, replies, content warnings, alt text, boost/favourite decisions, and moderation escalations.", true),
  capability("write", "Write Mastodon", "Post/edit/delete statuses, boost/favourite, follow, upload media, or send reports only after approval for visible actions.", false),
  capability("admin", "Admin Mastodon", "Use instance admin or moderation scopes only with explicit human approval and instance-policy awareness.", false),
];
