import { capability } from "../../catalog/marketplace-catalog.types";

export const FIGMA_CAPABILITIES = [
  capability("files_read", "Files and Nodes", "Read file metadata, node trees, versions, components, component sets, styles, variables and project file lists.", true),
  capability("comments_draft", "Comments Drafting", "Read comments and draft replies or review summaries before posting.", true),
  capability("renders_export", "Images and Renders", "Prepare bounded image export jobs for named node IDs and formats.", false),
  capability("comments_write", "Comment Writes", "Post or delete comments and reactions only after approval policy checks.", false),
  capability("webhooks_manage", "Webhooks", "Inspect or manage team/project/file webhooks when scopes and permissions allow.", false),
];
