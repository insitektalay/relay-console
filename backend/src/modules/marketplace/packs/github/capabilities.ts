import { capability, type MarketplaceCapability } from "../../catalog/marketplace-catalog.types";

export const GITHUB_CAPABILITIES: MarketplaceCapability[] = [
  capability(
    "repositories_read",
    "Repository Read",
    "Read repository metadata, branches, labels, workflow runs, and basic project state.",
    true,
  ),
  capability(
    "issues_write",
    "Issues",
    "Read issues and create or update issues and issue comments within policy.",
    true,
  ),
  capability(
    "pull_requests_write",
    "Pull Requests",
    "Read pull requests and prepare, open, or update pull requests within approval policy.",
    true,
  ),
  capability(
    "reviews_write",
    "Reviews & Comments",
    "Read review state and create pull request review comments or review submissions.",
    true,
  ),
  capability(
    "contents_read",
    "Repository Contents Read",
    "Read repository files and directory contents for analysis and safe drafting.",
    true,
  ),
  capability(
    "contents_write",
    "Repository Contents Write",
    "Create, update, or delete repository contents only when explicitly enabled and approved.",
    false,
  ),
  capability(
    "webhooks_manage",
    "Webhook Visibility",
    "Inspect webhook configuration and delivery health when connection permissions allow it.",
    false,
  ),
  capability(
    "releases_write",
    "Releases",
    "Draft or create releases and release notes when explicitly enabled and approved.",
    false,
  ),
];
