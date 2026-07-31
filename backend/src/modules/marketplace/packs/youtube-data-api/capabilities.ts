import { capability } from "../../catalog/marketplace-catalog.types";

export const YOUTUBE_DATA_API_CAPABILITIES = [
  capability("public_read", "Public Reads", "Use API-key or OAuth reads for public videos, channels, playlists and search.", true),
  capability("channel_read", "Channel Reads", "Read authenticated channel videos, comments, captions and live resources.", true),
  capability("draft_updates", "Draft Video/Comment Changes", "Prepare metadata, playlist, caption, thumbnail or comment updates without applying them.", true),
  capability("uploads_writes", "Uploads and Writes", "Upload/update/delete videos, thumbnails, captions, playlist items or comments after approval.", false),
  capability("moderation_owner", "Moderation and Owner Actions", "Comment moderation, live operations and content-owner workflows require explicit approval.", false),
];
