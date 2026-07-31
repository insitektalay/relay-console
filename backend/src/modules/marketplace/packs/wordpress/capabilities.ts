import { capability } from "../../catalog/marketplace-catalog.types";

export const WORDPRESS_CAPABILITIES = [
  capability("content_read", "Content Read", "Read posts, pages, revisions, statuses, taxonomies and exposed custom post types.", true),
  capability("media_comments_read", "Media and Comments Read", "Read media metadata and summarize comments/moderation queues.", true),
  capability("draft_content", "Draft Editorial Changes", "Prepare post/page/comment changes without publishing.", true),
  capability("content_write", "Content Writes", "Create/update posts, pages, media or taxonomy assignments after approval.", false),
  capability("admin_security", "Users, Settings and Plugins", "User, role, setting, plugin, theme and webhook/plugin boundaries remain high-risk.", false),
];
