import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { GRAVITY_FORMS_READ_OPERATIONS } from "./gravity-forms-api.adapter";

const read = action(
  "gravity_forms_read",
  "Read Gravity Forms",
  "Read form summaries, sanitized form schemas, and bounded explicitly selected entry fields from one configured site.",
);
const manage = blocked(
  "gravity_forms_manage",
  "Change Gravity Forms",
  "Form, entry, submission, notification, feed, webhook, and all other mutations are outside Relay's V1 contract.",
);

export const GRAVITY_FORMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "gravity-forms",
  name: "Gravity Forms",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.gravityforms.com/rest-api-v2/",
  providerWebsiteUrl: "https://www.gravityforms.com/",
  capabilities: [
    {
      ...capability(
        "gravity_forms_read",
        "Read forms and selected entry fields",
        "Use four pinned REST API v2 reads for form summaries, sanitized schemas, and at most 25 entries with at most 20 explicitly selected fields.",
        true,
      ),
      platformCapability: "gravity_forms_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "GRAVITY_FORMS_SITE_URL",
        label: "Gravity Forms site URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the public HTTPS WordPress site URL. Relay sends requests only to that site's /wp-json/gf/v2 route.",
      },
      {
        name: "GRAVITY_FORMS_CONSUMER_KEY",
        label: "Read-only consumer key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a Gravity Forms REST API v2 key with Read permission for a dedicated least-privilege WordPress user.",
      },
      {
        name: "GRAVITY_FORMS_CONSUMER_SECRET",
        label: "Consumer secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the matching secret when the read-only key is created; Gravity Forms displays it only once.",
      },
    ],
  },
  tools: [
    {
      name: "gravityForms.read",
      functionName: "gravity_forms_read",
      aliases: ["gravityForms.read", "gravity_forms_read"],
      capability: "gravity_forms_read",
      platformCapability: "gravity_forms_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned read-only Gravity Forms REST API v2 operation with bounded entry fields and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...GRAVITY_FORMS_READ_OPERATIONS],
          },
          formId: { type: ["string", "integer"], maxLength: 19 },
          entryId: { type: ["string", "integer"], maxLength: 19 },
          fieldIds: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            items: { type: ["string", "integer"], maxLength: 40 },
          },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          offset: { type: "integer", minimum: 0, maximum: 10000 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "gravity_forms_safe",
      label: "Safe",
      description:
        "Four bounded reads run directly. Every Gravity Forms or WordPress mutation remains blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "read_only_key_and_forms",
      label: "Public site, read-only key, and form-list access check",
    },
  ],
};
