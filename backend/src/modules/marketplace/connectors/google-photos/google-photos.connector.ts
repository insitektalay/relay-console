import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_PHOTOS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
];

const reads = [
  action(
    "google_photos_picker_session_get",
    "Get photo selection session",
    "Check one explicit Picker session once without automatic polling.",
  ),
  action(
    "google_photos_picked_media_list",
    "List selected photo metadata",
    "Return the first twenty-five metadata summaries explicitly selected by the user.",
  ),
];
const writes = [
  action(
    "google_photos_picker_session_create",
    "Create photo selection session",
    "Create one user-controlled Picker session for at most twenty-five items.",
  ),
  action(
    "google_photos_picker_session_delete",
    "Clean up photo selection session",
    "Delete one Picker session without deleting user media.",
  ),
];
const blockedActions = [
  blocked(
    "google_photos_removed_library_scopes",
    "Use removed Photos Library scopes",
    "Removed whole-library, sharing, and broad Library scopes are forbidden.",
  ),
  blocked(
    "google_photos_library_upload_edit",
    "Upload or edit Library content",
    "Library API uploads, imports, albums, and app-created-data management are outside V1.",
  ),
  blocked(
    "google_photos_raw_media",
    "Access raw selected media",
    "Raw bytes, thumbnails, transient base URLs, and camera or EXIF metadata are withheld.",
  ),
  blocked(
    "google_photos_library_search_sharing",
    "Search or share Photos Library",
    "Whole-library access, albums, search, and sharing are outside Picker-only V1.",
  ),
  blocked(
    "google_photos_face_ml_ads",
    "Analyze faces or repurpose Photos data",
    "Face analysis, unrelated ML training, advertising, brokerage, and competing galleries are blocked.",
  ),
  blocked(
    "google_photos_auto_poll_paginate",
    "Automatically poll or paginate",
    "Automatic polling and page-token following are blocked in V1.",
  ),
  blocked(
    "google_photos_raw_delegation",
    "Run raw or delegated Photos access",
    "Raw endpoints, service accounts, and domain-wide delegation are blocked.",
  ),
];
const sessionId = {
  type: "string",
  minLength: 1,
  maxLength: 512,
  pattern: "^[A-Za-z0-9_-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const GOOGLE_PHOTOS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "google-photos",
  name: "Google Photos",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.google.com/photos/picker",
  providerWebsiteUrl: "https://photos.google.com/",
  capabilities: [
    {
      ...capability(
        "picker_session_read",
        "Check Picker sessions",
        "Inspect one explicit Picker session once without automatic polling.",
        true,
      ),
      platformCapability: "google_photos_picker_session_read",
    },
    {
      ...capability(
        "picked_media_read",
        "Read selected metadata",
        "Read one first page of bounded metadata for user-selected media.",
        true,
      ),
      platformCapability: "google_photos_picked_media_read",
    },
    {
      ...capability(
        "picker_session_write",
        "Manage Picker sessions",
        "Create and clean up bounded user-controlled selection sessions.",
        true,
      ),
      platformCapability: "google_photos_picker_session_write",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      refreshUrl: "https://oauth2.googleapis.com/token",
      revocationUrl: "https://oauth2.googleapis.com/revoke",
      requiredScopes: GOOGLE_PHOTOS_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "GOOGLE_OAUTH_CLIENT_ID",
        label: "Google OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console confidential web OAuth client ID.",
      },
      {
        name: "GOOGLE_OAUTH_CLIENT_SECRET",
        label: "Google OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Google OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "googlePhotos.createPickerSession",
      functionName: "google_photos_picker_session_create",
      aliases: ["google_photos_picker_session_create"],
      capability: "picker_session_write",
      platformCapability: "google_photos_picker_session_write",
      action: "write",
      approvalRequired: true,
      description:
        "Create one user-controlled Google Photos Picker session for one to twenty-five items.",
      inputSchema: {
        type: "object",
        properties: {
          maxItemCount: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        required: ["approvalId"],
        additionalProperties: false,
      },
    },
    {
      name: "googlePhotos.getPickerSession",
      functionName: "google_photos_picker_session_get",
      aliases: ["google_photos_picker_session_get"],
      capability: "picker_session_read",
      platformCapability: "google_photos_picker_session_read",
      action: "read",
      approvalRequired: false,
      description:
        "Inspect one exact Picker session once and return provider polling guidance without polling.",
      inputSchema: {
        type: "object",
        properties: { sessionId },
        required: ["sessionId"],
        additionalProperties: false,
      },
    },
    {
      name: "googlePhotos.listPickedMedia",
      functionName: "google_photos_picked_media_list",
      aliases: ["google_photos_picked_media_list"],
      capability: "picked_media_read",
      platformCapability: "google_photos_picked_media_read",
      action: "read",
      approvalRequired: false,
      description:
        "Read at most twenty-five metadata-only items from one completed Picker session without following pagination.",
      inputSchema: {
        type: "object",
        properties: { sessionId },
        required: ["sessionId"],
        additionalProperties: false,
      },
    },
    {
      name: "googlePhotos.deletePickerSession",
      functionName: "google_photos_picker_session_delete",
      aliases: ["google_photos_picker_session_delete"],
      capability: "picker_session_write",
      platformCapability: "google_photos_picker_session_write",
      action: "write",
      approvalRequired: true,
      description:
        "Delete one exact Picker session as privacy cleanup without deleting user media.",
      inputSchema: {
        type: "object",
        properties: { sessionId, approvalId },
        required: ["sessionId", "approvalId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "google_photos_safe",
      label: "Safe",
      description:
        "Explicit session checks and first-page metadata reads run automatically; session creation and cleanup require matching approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All four selected tools run without Relay per-action approval while exact Picker scope, user selection, item and page limits, metadata redaction, no-polling, audit, refresh, revocation, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "picker-only-photos",
      label:
        "Google account, exact Picker scope, explicit user selection, and metadata-only output",
      requiredScopes: GOOGLE_PHOTOS_SCOPES,
    },
  ],
};
