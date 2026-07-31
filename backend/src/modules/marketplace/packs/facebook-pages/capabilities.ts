import { capability } from "../../catalog/marketplace-catalog.types";

export const FACEBOOK_PAGES_CAPABILITIES = [
  capability(
    "read_selected_page",
    "Read selected Page",
    "Read bounded metadata for the one Page immutably selected during connection.",
    true,
  ),
  capability(
    "read_own_posts",
    "Read Page-authored posts",
    "List one page of at most ten posts authored by the selected Page.",
    true,
  ),
  capability(
    "draft_posts",
    "Draft Page posts locally",
    "Prepare a bounded plain-text Page post without calling Meta.",
    true,
  ),
  capability(
    "publish_posts",
    "Publish plain-text Page posts",
    "Publish one approved plain-text post to the selected Page.",
    true,
  ),
];
