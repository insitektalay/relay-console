import { capability } from "../../catalog/marketplace-catalog.types";

export const TIKTOK_CAPABILITIES = [
  capability("read", "Read TikTok", "Read creator posting configuration, video status, and authorized profile metadata where TikTok scopes permit it.", true),
  capability("draft", "Draft TikTok", "Draft captions, disclosure text, upload checklists, privacy settings, and posting plans.", true),
  capability("write", "Write TikTok", "Upload or direct-post videos, update captions/options, or manage comments only after approval.", false),
  capability("admin", "Admin TikTok", "Change app scopes, creator account authorization, branded-content policy, or high-volume posting workflows only with approval.", false),
];
