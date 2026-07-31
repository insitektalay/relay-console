import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { AIRTABLE_FORMS_READ_OPERATIONS } from "./airtable-forms-api.adapter";

const read = action(
  "airtable_forms_read",
  "List Airtable forms",
  "List minimized form-view metadata for one explicitly granted base.",
);
const manage = blocked(
  "airtable_forms_manage",
  "Change Airtable forms",
  "Form creation, configuration, publication, sharing, prefills, submissions, records, interfaces, automations, and every mutation remain blocked.",
);

export const AIRTABLE_FORMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "airtable-forms",
  name: "Airtable Forms",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://airtable.com/developers/web/api/list-views",
  providerWebsiteUrl: "https://www.airtable.com/platform/forms",
  capabilities: [
    {
      ...capability(
        "airtable_forms_read",
        "Read form metadata",
        "Use the pinned List views GET and return only minimized form views for one granted base.",
        true,
      ),
      platformCapability: "airtable_forms_read",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl: "https://airtable.com/oauth2/v1/authorize",
      tokenUrl: "https://airtable.com/oauth2/v1/token",
      refreshUrl: "https://airtable.com/oauth2/v1/token",
      requiredScopes: ["workspacesAndBases:read"],
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "AIRTABLE_FORMS_CLIENT_ID",
        label: "Airtable Forms OAuth client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        helpText:
          "Railway-held Relay Console Airtable Forms OAuth integration client ID.",
      },
      {
        name: "AIRTABLE_FORMS_CLIENT_SECRET",
        label: "Airtable Forms OAuth client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Railway-held Airtable Forms OAuth client secret; never sent to clients or agents.",
      },
    ],
  },
  tools: [
    {
      name: "airtable-forms.read",
      functionName: "airtable_forms_read",
      aliases: ["airtable-forms.read", "airtable_forms_read"],
      capability: "airtable_forms_read",
      platformCapability: "airtable_forms_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized form views for one granted Airtable base.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...AIRTABLE_FORMS_READ_OPERATIONS],
          },
          baseId: { type: "string", minLength: 17, maxLength: 17 },
        },
        required: ["operation", "baseId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "airtable_forms_safe",
      label: "Safe",
      description:
        "One minimized form-view index runs directly. User IDs, visible fields, share links, submissions, records, arbitrary APIs, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "oauth_and_views",
      label: "OAuth and base-view metadata access check",
    },
  ],
};
