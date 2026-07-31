import { capability } from "../../catalog/marketplace-catalog.types";

export const PINTEREST_CAPABILITIES = [
  capability("read", "Read Pinterest", "Read boards, pins, account metadata, media status, and analytics with authorized scopes.", true),
  capability("draft", "Draft Pinterest", "Draft pin titles, descriptions, board placement, creative briefs, and campaign plans.", true),
  capability("write", "Write Pinterest", "Create or update pins/boards/media only after approval for public publishing.", false),
  capability("admin", "Admin Pinterest", "Change catalog connections, account settings, ad-related surfaces, or bulk board operations only with approval.", false),
];
