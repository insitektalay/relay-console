import { action, blocked } from "../../catalog/marketplace-catalog.types";

const reads = [
  action(
    "x_account_get",
    "Read connected account",
    "Read the OAuth-bound X account identity.",
  ),
  action(
    "x_own_posts_list",
    "List own original Posts",
    "Read at most ten recent original Posts in one request.",
  ),
  action(
    "x_post_draft",
    "Draft a text Post",
    "Prepare a bounded plain-text draft locally without a provider call.",
  ),
];

const publish = action(
  "x_text_post_create",
  "Publish a text Post",
  "Publishing one original plain-text Post requires explicit approval unless Direct writes are selected.",
);

const forbidden = [
  blocked(
    "x_reply_engagement",
    "Replies and engagement",
    "Replies, quotes, reposts, likes, and other engagement are blocked.",
  ),
  blocked(
    "x_arbitrary_reads",
    "Arbitrary reads",
    "Search, mentions, home or foreign timelines, and raw lookups are blocked.",
  ),
  blocked(
    "x_media_private_admin",
    "Media, private, and admin actions",
    "Media, DMs, follows, lists, moderation, edit, delete, and account administration are blocked.",
  ),
  blocked(
    "x_bulk_schedule_raw",
    "Bulk, scheduled, or raw access",
    "Bulk posting, scheduling, polling, pagination, retries, and raw API access are blocked.",
  ),
];

export const X_APPROVAL_PROFILES = [
  {
    id: "x_blocked",
    label: "Blocked",
    description: "Expose no X actions.",
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
    id: "x_read_only",
    label: "Read Only",
    description: "Read the connected account and own Posts, and draft locally.",
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
    id: "x_approval_required",
    label: "Approval Required",
    description:
      "Reads and drafts are allowed; every publish requires approval.",
    defaultSelected: true,
    allowedActions: reads,
    approvalRequiredActions: [publish],
    blockedActions: forbidden,
  },
  {
    id: "x_direct_writes",
    label: "Approval Required (Legacy Direct Writes)",
    description:
      "Existing Direct Writes selections are retained safely, but every publish now requires approval.",
    defaultSelected: false,
    allowedActions: reads,
    approvalRequiredActions: [publish],
    blockedActions: forbidden,
  },
];
