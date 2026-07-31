import { capability } from "../../catalog/marketplace-catalog.types";

export const THREADS_CAPABILITIES = [
  capability("read", "Read Threads", "Read Threads profile, posts, replies, publishing status, and insight metrics where permitted.", true),
  capability("draft", "Draft Threads", "Draft posts, replies, thread sequences, media captions, and response plans.", true),
  capability("write", "Write Threads", "Publish posts, replies, media, or reply-management actions only after explicit approval.", false),
  capability("admin", "Admin Threads", "Change app permissions, federated sharing posture, reply controls at scale, or webhook-like subscriptions only with approval.", false),
];
