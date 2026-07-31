import { capability } from "../../catalog/marketplace-catalog.types";

export const CANVA_CAPABILITIES = [
  capability("designs_read", "Designs Read", "Read design metadata/content and inspect export readiness within granted scopes.", true),
  capability("folders_assets_read", "Folders and Assets Read", "Read folders, assets/uploads and brand-template metadata.", true),
  capability("comments_draft", "Comments Drafting", "Read comments and draft replies without posting.", true),
  capability("exports_write", "Exports and Uploads", "Create approved export jobs or upload assets after approval.", false),
  capability("permissions_manage", "Folder Permissions", "Set, update or remove folder permissions only after explicit approval.", false),
];
