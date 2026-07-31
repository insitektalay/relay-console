import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { NINJA_FORMS_READ_OPERATIONS } from "./ninja-forms-api.adapter";

const read = action(
  "ninja_forms_read",
  "Read Ninja Forms",
  "Read bounded form metadata, schemas, calculations, field types, and one exact submission's labeled fields from one configured site.",
);
const manage = blocked(
  "ninja_forms_manage",
  "Change Ninja Forms",
  "Form, field, action, calculation, submission, plugin-setting, export, and all other mutations are outside Relay's V1 contract.",
);

export const NINJA_FORMS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "ninja-forms",
  name: "Ninja Forms",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://ninjaforms.com/docs/abilities-api/",
  providerWebsiteUrl: "https://ninjaforms.com/",
  capabilities: [
    {
      ...capability(
        "ninja_forms_read",
        "Read forms and exact submission fields",
        "Use five pinned Ninja Forms abilities for bounded form discovery, sanitized schemas, field types, calculations, and one exact submission's labeled fields.",
        true,
      ),
      platformCapability: "ninja_forms_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NINJA_FORMS_SITE_URL",
        label: "Ninja Forms site URL",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the public HTTPS WordPress site URL. Relay sends requests only to that site's Ninja Forms WordPress Abilities API route.",
      },
      {
        name: "NINJA_FORMS_USERNAME",
        label: "WordPress username",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Use a dedicated WordPress administrator because Ninja Forms requires its form-management capability for every official ability.",
      },
      {
        name: "NINJA_FORMS_APPLICATION_PASSWORD",
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
      name: "ninjaForms.read",
      functionName: "ninja_forms_read",
      aliases: ["ninjaForms.read", "ninja_forms_read"],
      capability: "ninja_forms_read",
      platformCapability: "ninja_forms_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned, bounded Ninja Forms ability without arbitrary WordPress or ability access.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...NINJA_FORMS_READ_OPERATIONS],
          },
          formId: { type: ["string", "integer"], maxLength: 19 },
          submissionId: { type: ["string", "integer"], maxLength: 19 },
          title: { type: "string", minLength: 1, maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 25 },
          format: { type: "string", enum: ["simple", "detailed"] },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "ninja_forms_safe",
      label: "Safe",
      description:
        "Five pinned reads run directly. Unbounded submission lists and every Ninja Forms or WordPress mutation remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "site_application_password_and_abilities",
      label:
        "Public site, Application Password, and Ninja Forms abilities check",
    },
  ],
};
