import { action, blocked } from "../../catalog/marketplace-catalog.types";

const reads = [
  action(
    "instagram_business_account_get",
    "Read professional account",
    "Read bounded metadata for the bound Business or Creator account.",
  ),
  action(
    "instagram_business_own_media_list",
    "List owned media",
    "Read one page of at most ten recent owned media summaries.",
  ),
  action(
    "instagram_business_own_media_get",
    "Read owned media item",
    "Read one item only after verifying it belongs to the bound account.",
  ),
];
const deferred = [
  blocked(
    "instagram_business_publishing_engagement",
    "Publishing and engagement",
    "Publishing, comments, replies, likes, and moderation are blocked.",
  ),
  blocked(
    "instagram_business_messages_people",
    "Messages and people data",
    "Messages, followers, commenters, likers, mentions, tagging, discovery, and search are blocked.",
  ),
  blocked(
    "instagram_business_insights_ads_media",
    "Insights and media bytes",
    "Insights, ads, shopping, media upload/download, and webhooks are blocked.",
  ),
  blocked(
    "instagram_business_broad_access",
    "Broad or raw access",
    "Pagination, export, raw Graph access, arbitrary accounts, and browser automation are blocked.",
  ),
];

export const INSTAGRAM_BUSINESS_APPROVAL_PROFILES = [
  {
    id: "instagram_business_no_access",
    label: "No Access",
    description: "Expose no Instagram Business actions.",
    defaultSelected: false,
    allowedActions: [],
    approvalRequiredActions: [],
    blockedActions: [
      ...reads.map((item) =>
        blocked(item.id, item.label, "Blocked by authority preset."),
      ),
      ...deferred,
    ],
  },
  {
    id: "instagram_business_read_only",
    label: "Read Only",
    description:
      "Read only the bound professional account and its owned-media metadata.",
    defaultSelected: true,
    allowedActions: reads,
    approvalRequiredActions: [],
    blockedActions: deferred,
  },
];
