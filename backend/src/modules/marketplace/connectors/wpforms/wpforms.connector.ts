import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { WPFORMS_READ_OPERATIONS } from "./wpforms-api.adapter";

const read = action(
  "wpforms_read",
  "Read WPForms",
  "Read bounded form metadata, curated schemas, form statistics, entry summaries, and one exact entry from one configured site.",
);
const manage = blocked(
  "wpforms_manage",
  "Change WPForms",
  "Form, field, setting, entry, notification, confirmation, integration, and all other mutations are outside Relay's V1 contract.",
);

export const WPFORMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "wpforms",
  name: "WPForms",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://wpforms.com/developers/wpforms-rest-api/",
  providerWebsiteUrl: "https://wpforms.com/",
  capabilities: [
    {
      ...capability(
        "wpforms_read",
        "Read forms and bounded entries",
        "Use five pinned read abilities for bounded form discovery, curated schemas, statistics, metadata-only entry summaries, and one exact entry.",
        true,
      ),
      platformCapability: "wpforms_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "WPFORMS_SITE_URL",
        label: "WPForms site URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the public HTTPS WordPress site URL. Relay sends requests only to that site's WPForms WordPress Abilities API route.",
      },
      {
        name: "WPFORMS_USERNAME",
        label: "WordPress username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated WordPress user with only the WPForms view capabilities needed for the selected reads.",
      },
      {
        name: "WPFORMS_APPLICATION_PASSWORD",
        label: "WordPress Application Password",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Create a dedicated revocable WordPress Application Password for Relay; never enter the user's normal WordPress password.",
      },
    ],
  },
  tools: [
    {
      name: "wpforms.read",
      functionName: "wpforms_read",
      aliases: ["wpforms.read", "wpforms_read"],
      capability: "wpforms_read",
      platformCapability: "wpforms_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, bounded WPForms read ability without arbitrary WordPress or ability access.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...WPFORMS_READ_OPERATIONS] },
          formId: { type: ["string", "integer"], maxLength: 19 },
          entryId: { type: ["string", "integer"], maxLength: 19 },
          status: {
            type: "string",
            enum: [
              "",
              "publish",
              "draft",
              "trash",
              "partial",
              "abandoned",
              "spam",
            ],
          },
          type: { type: "string", enum: ["", "read", "unread", "starred"] },
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
      id: "wpforms_safe",
      label: "Safe",
      description:
        "Five pinned reads run directly. Cross-form search, field-bearing entry lists, arbitrary abilities, and every mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "site_application_password_and_abilities",
      label: "Public site, Application Password, and WPForms abilities check",
    },
  ],
};
