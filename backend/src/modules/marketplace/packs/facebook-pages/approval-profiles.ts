import { action, blocked } from "../../catalog/marketplace-catalog.types";

const reads = [
  action(
    "facebook_pages_page_get",
    "Read selected Page",
    "Read bounded metadata for the immutably selected Page.",
  ),
  action(
    "facebook_pages_own_posts_list",
    "List Page-authored posts",
    "Read at most ten recent posts authored by the selected Page.",
  ),
  action(
    "facebook_pages_post_draft",
    "Draft a Page post",
    "Prepare a bounded plain-text draft locally without a provider call.",
  ),
];
const publish = action(
  "facebook_pages_text_post_create",
  "Publish Page text post",
  "Publishing one plain-text post to the selected Page requires approval unless Direct writes are selected.",
);
const forbidden = [
  blocked(
    "facebook_pages_comments_engagement",
    "Comments and engagement",
    "Comments, replies, reactions, and visitor-feed activity are blocked.",
  ),
  blocked(
    "facebook_pages_messages",
    "Page messages",
    "Page messaging and private communication are blocked.",
  ),
  blocked(
    "facebook_pages_media_insights_ads",
    "Media and broader Page products",
    "Media, stories, reels, insights, ads, leads, events, and search are blocked.",
  ),
  blocked(
    "facebook_pages_admin_mutation",
    "Administrative and destructive actions",
    "Roles, settings, webhooks, edit, delete, scheduling, bulk actions, pagination, and raw Graph access are blocked.",
  ),
];

export const FACEBOOK_PAGES_APPROVAL_PROFILES = [
  {
    id: "facebook_pages_blocked",
    label: "Blocked",
    description: "Expose no Facebook Pages actions.",
    defaultSelected: false,
    allowedActions: [],
    approvalRequiredActions: [],
    blockedActions: [
      ...reads.map((item) =>
        blocked(item.id, item.label, "Blocked by authority preset."),
      ),
      blocked(publish.id, publish.label, "Blocked by authority preset."),
      ...forbidden,
    ],
  },
  {
    id: "facebook_pages_read_only",
    label: "Read Only",
    description: "Read the selected Page and its posts, and draft locally.",
    defaultSelected: false,
    allowedActions: reads,
    approvalRequiredActions: [],
    blockedActions: [
      blocked(
        publish.id,
        publish.label,
        "Publishing is blocked by the read-only preset.",
      ),
      ...forbidden,
    ],
  },
  {
    id: "facebook_pages_approval_required",
    label: "Approval Required",
    description:
      "Reads and drafts are allowed; every Page publish requires approval.",
    defaultSelected: true,
    allowedActions: reads,
    approvalRequiredActions: [publish],
    blockedActions: forbidden,
  },
  {
    id: "facebook_pages_direct_writes",
    label: "Approval Required (Legacy Direct Writes)",
    description:
      "Existing Direct Writes selections are retained safely, but every Page publish now requires approval.",
    defaultSelected: false,
    allowedActions: reads,
    approvalRequiredActions: [publish],
    blockedActions: forbidden,
  },
];
