import { capability } from "../../catalog/marketplace-catalog.types";

export const LINKEDIN_CAPABILITIES = [
  capability("read", "Read LinkedIn", "Read organization/member post context, comments, likes, media metadata, and analytics where product access permits it.", true),
  capability("draft", "Draft LinkedIn", "Draft professional posts, executive comments, response plans, and content calendars.", true),
  capability("write", "Write LinkedIn", "Publish member or organization posts, comments, reactions, or media uploads only after approval.", false),
  capability("admin", "Admin LinkedIn", "Change organization permissions, product access, ad accounts, or compliance settings only with explicit approval.", false),
];
