import { capability } from "../../catalog/marketplace-catalog.types";

export const DROPBOX_CAPABILITIES = [
  capability("read", "Read Dropbox", "Read Dropbox files/list_folder entries, cursors, metadata, downloads, revs, namespace ids, team folders, shared links, file locks, and webhook cursor state with bounded paths.", true),
  capability("draft", "Draft Dropbox", "Prepare exact Dropbox upload, download, move, copy, delete, restore, shared-link, file-lock, team-folder, or webhook payloads without side effects.", true),
  capability("write", "Write Dropbox", "Upload/update/move/copy/delete selected Dropbox files and folders, create shared links, or adjust sharing after OAuth scope, namespace, and approval checks.", false),
  capability("admin", "Admin Dropbox", "Operate Dropbox team folders, namespaces, external sharing policy, large exports/downloads, webhooks, and destructive file/team operations under explicit approval.", false),
];
