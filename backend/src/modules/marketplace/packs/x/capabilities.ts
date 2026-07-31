import { capability } from "../../catalog/marketplace-catalog.types";

export const X_CAPABILITIES = [
  capability(
    "read_connected_account",
    "Read connected account",
    "Read the OAuth-bound X account's id, name, and username.",
    true,
  ),
  capability(
    "read_own_posts",
    "Read own original Posts",
    "List at most ten recent original Posts from the connected account in one request.",
    true,
  ),
  capability(
    "draft_posts",
    "Draft Posts locally",
    "Prepare a plain-text Post locally without calling X.",
    true,
  ),
  capability(
    "publish_posts",
    "Publish plain-text Posts",
    "Publish one approved plain-text original Post with AI disclosure.",
    true,
  ),
];
