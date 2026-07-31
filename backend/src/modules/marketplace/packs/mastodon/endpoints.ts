export const MASTODON_ENDPOINT_FAMILIES = [
  { id: "oauth", label: "Mastodon OAuth", docsUrl: "https://docs.joinmastodon.org/spec/oauth/", guidance: "Register per-instance applications and request minimum scopes." },
  { id: "statuses", label: "Statuses API", docsUrl: "https://docs.joinmastodon.org/methods/statuses/", guidance: "Create statuses, replies, boosts, favourites, bookmarks, pins, edits, and deletes within approval policy." },
  { id: "media", label: "Media attachments", docsUrl: "https://docs.joinmastodon.org/methods/media/", guidance: "Upload media before status creation and include descriptions for accessibility." },
  { id: "notifications", label: "Notifications and timelines", docsUrl: "https://docs.joinmastodon.org/methods/notifications/", guidance: "Read notifications, mentions, and timelines with bounded queries." },
];
