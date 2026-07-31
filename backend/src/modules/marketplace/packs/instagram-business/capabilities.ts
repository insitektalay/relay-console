import { capability } from "../../catalog/marketplace-catalog.types";

export const INSTAGRAM_BUSINESS_CAPABILITIES = [
  capability(
    "read_bound_account",
    "Read bound professional account",
    "Read bounded identity and account metadata for the authenticated Business or Creator account.",
    true,
  ),
  capability(
    "read_own_media",
    "Read owned media",
    "List at most ten recent owned media summaries and inspect one ownership-checked item.",
    true,
  ),
];
