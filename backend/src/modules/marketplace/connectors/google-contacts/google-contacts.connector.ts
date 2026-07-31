import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const GOOGLE_CONTACTS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/contacts",
];
const reads = [
  action(
    "google_contacts_connections_list",
    "List contacts",
    "Return at most fifty contact-source People with privacy-bounded fields.",
  ),
  action(
    "google_contacts_contact_get",
    "Read contact",
    "Read one exact contact-source Person with privacy-bounded fields.",
  ),
  action(
    "google_contacts_update_prepare",
    "Prepare contact update",
    "Validate and hash one contact creation or safe patch locally.",
  ),
];
const writes = [
  action(
    "google_contacts_contact_create",
    "Create contact",
    "Create one contact with bounded allowlisted fields.",
  ),
  action(
    "google_contacts_contact_patch",
    "Update contact",
    "Update allowlisted fields after latest-source ETag preflight.",
  ),
];
const blockedActions = [
  blocked(
    "google_contacts_delete_photos_batch",
    "Delete contacts or mutate photos in batches",
    "Deletion, photos, and batch create, update, or delete operations are blocked in V1.",
  ),
  blocked(
    "google_contacts_groups",
    "Manage contact groups",
    "Contact groups and membership changes are blocked in V1.",
  ),
  blocked(
    "google_contacts_other_directory",
    "Access other contacts or directory",
    "Other contacts, directory profiles, search, and copying are blocked in V1.",
  ),
  blocked(
    "google_contacts_broad_fields",
    "Access broad personal fields",
    "Addresses, birthdays, biographies, relations, events, locations, and other excluded Person fields are blocked in V1.",
  ),
  blocked(
    "google_contacts_raw_sync",
    "Run raw, synchronized, or delegated access",
    "Automatic pagination, sync tokens, domain delegation, raw API calls, and raw MCP tools are blocked in V1.",
  ),
];
const resourceName = {
  type: "string",
  minLength: 8,
  maxLength: 512,
  pattern: "^people/[A-Za-z0-9_-]+$",
};
const approvalId = { type: "string", minLength: 1, maxLength: 200 };
const idempotencyKey = { type: "string", minLength: 8, maxLength: 200 };
const writeFields = {
  givenName: { type: "string", minLength: 1, maxLength: 256 },
  familyName: { type: "string", minLength: 1, maxLength: 256 },
  emailAddresses: { type: "array", maxItems: 5 },
  phoneNumbers: { type: "array", maxItems: 5 },
  organizations: { type: "array", maxItems: 3 },
};

export const GOOGLE_CONTACTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "google-contacts",
    name: "Google Contacts",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developers.google.com/people/v1/how-tos/authorizing",
    providerWebsiteUrl: "https://contacts.google.com/",
    capabilities: [
      {
        ...capability(
          "contact_read",
          "Read contacts",
          "Read bounded contact-source People with a narrow field mask.",
          true,
        ),
        platformCapability: "google_contacts_contact_read",
      },
      {
        ...capability(
          "contact_draft",
          "Prepare contact changes",
          "Validate and hash privacy-bounded contact changes locally.",
          true,
        ),
        platformCapability: "google_contacts_contact_draft",
      },
      {
        ...capability(
          "contact_write",
          "Create and update contacts",
          "Create contacts and safely update allowlisted fields after policy checks.",
          true,
        ),
        platformCapability: "google_contacts_contact_write",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        refreshUrl: "https://oauth2.googleapis.com/token",
        revocationUrl: "https://oauth2.googleapis.com/revoke",
        requiredScopes: GOOGLE_CONTACTS_SCOPES,
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
        name: "googleContacts.listContacts",
        functionName: "google_contacts_connections_list",
        aliases: ["google_contacts_connections_list"],
        capability: "contact_read",
        platformCapability: "google_contacts_contact_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read the first fifty contact-source People without following pagination.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "googleContacts.getContact",
        functionName: "google_contacts_contact_get",
        aliases: ["google_contacts_contact_get"],
        capability: "contact_read",
        platformCapability: "google_contacts_contact_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one exact contact-source Person using a narrow field mask.",
        inputSchema: {
          type: "object",
          properties: { resourceName },
          required: ["resourceName"],
          additionalProperties: false,
        },
      },
      {
        name: "googleContacts.prepareUpdate",
        functionName: "google_contacts_update_prepare",
        aliases: ["google_contacts_update_prepare"],
        capability: "contact_draft",
        platformCapability: "google_contacts_contact_draft",
        action: "draft",
        approvalRequired: false,
        description: "Validate and hash one contact create or patch locally.",
        inputSchema: {
          type: "object",
          properties: {
            operation: { type: "string", enum: ["create", "patch"] },
            resourceName,
            ...writeFields,
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
      {
        name: "googleContacts.createContact",
        functionName: "google_contacts_contact_create",
        aliases: ["google_contacts_contact_create"],
        capability: "contact_write",
        platformCapability: "google_contacts_contact_write",
        action: "write",
        approvalRequired: true,
        description:
          "Create one contact with bounded names, email, phone, and organization fields.",
        inputSchema: {
          type: "object",
          properties: { ...writeFields, approvalId, idempotencyKey },
          required: ["givenName", "approvalId", "idempotencyKey"],
          additionalProperties: false,
        },
      },
      {
        name: "googleContacts.updateContact",
        functionName: "google_contacts_contact_patch",
        aliases: ["google_contacts_contact_patch"],
        capability: "contact_write",
        platformCapability: "google_contacts_contact_write",
        action: "write",
        approvalRequired: true,
        description:
          "Update allowlisted fields after fetching the latest contact source and ETag.",
        inputSchema: {
          type: "object",
          properties: {
            resourceName,
            ...writeFields,
            approvalId,
            idempotencyKey,
          },
          required: ["resourceName", "approvalId", "idempotencyKey"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "google_contacts_safe",
        label: "Safe",
        description:
          "Privacy-bounded first-page reads and local preparation run automatically; contact creation and updates require matching approval.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: writes,
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "All five selected tools run without Relay per-action approval while exact scope, contact-source and field-mask limits, latest ETags, audit, redaction, refresh, revocation, and provider limits remain enforced.",
        defaultSelected: false,
        allowedActions: [...reads, ...writes],
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "privacy-bounded-contacts",
        label:
          "Google account, exact Contacts scope, contact-source-only access, and narrow fields",
        requiredScopes: GOOGLE_CONTACTS_SCOPES,
      },
    ],
  };
