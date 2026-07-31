import { capability } from "../../catalog/marketplace-catalog.types";

export const GOOGLE_DRIVE_CAPABILITIES = [
  capability("read", "Read Google Drive", "Read Google Drive files, folders with MIME type application/vnd.google-apps.folder, permissions roles owner/organizer/fileOrganizer/writer/commenter/reader with bounded provider queries.", true),
  capability("draft", "Draft Google Drive", "Prepare exact Drive files.create/update/copy/export/download, permissions.create/update/delete, shortcut, move, revision, or changes.watch payloads without side effects.", true),
  capability("write", "Write Google Drive", "Create/update/move/copy/upload selected Drive files and folders, export/download requested files, and change permissions only after Drive scope and approval checks.", false),
  capability("admin", "Admin Google Drive", "Operate Drive ownership transfers, shared drive organizer changes, external/public sharing, large exports, watch channels, irreversible deletes, and broad Drive access under explicit approval.", false),
];
