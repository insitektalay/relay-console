import { capability } from "../../catalog/marketplace-catalog.types";

export const BLUESKY_CAPABILITIES = [
  capability("read", "Read Bluesky", "Read profiles, feeds, threads, posts, likes, reposts, labels, and DID/handle metadata.", true),
  capability("draft", "Draft Bluesky", "Draft posts, replies, quote posts, alt text, thread sequences, and moderation-aware response plans.", true),
  capability("write", "Write Bluesky", "Create/delete records, post replies, like/repost, follow, or update profile fields only after approval.", false),
  capability("admin", "Admin Bluesky", "Change handles, labels, moderation service settings, feeds, or app-password credentials only with approval.", false),
];
