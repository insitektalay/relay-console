import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { OSANO_OPERATIONS } from "./osano-api.adapter";

const read = action(
  "osano_read",
  "List consent configurations",
  "List up to 20 minimized Cookie Consent configuration records.",
);
const manage = blocked(
  "osano_manage",
  "Access privacy subjects or change Osano",
  "Domains, detailed configuration, discoveries, rules, subject-rights requests, messages, consents, subjects, assessments, connectors, webhooks, publishing, and every mutation are unavailable.",
);
export const OSANO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "osano",
  name: "Osano",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.osano.com/customer-rest-api",
  providerWebsiteUrl: "https://www.osano.com/",
  capabilities: [
    {
      ...capability(
        "consent_configuration_read",
        "Read consent configurations",
        "List a bounded, minimized directory of Cookie Consent configurations visible to the API key.",
        true,
      ),
      platformCapability: "osano_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "OSANO_API_KEY",
        label: "Osano API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A customer-owned per-user API key belonging to a dedicated least-privilege Osano user.",
      },
    ],
  },
  tools: [
    {
      name: "osano.listCookieConsentConfigs",
      functionName: "osano_read",
      aliases: ["osano.listCookieConsentConfigs", "osano_read"],
      capability: "consent_configuration_read",
      platformCapability: "osano_read",
      action: "read",
      approvalRequired: false,
      description: "List minimized Cookie Consent configuration metadata.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: [...OSANO_OPERATIONS] },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "osano_safe",
      label: "Safe",
      description:
        "One bounded configuration-directory read runs directly; privacy-subject data, detailed settings, and all mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [],
      blockedActions: [manage],
    },
  ],
  healthChecks: [
    {
      id: "cookie_consent_directory",
      label:
        "Osano API key and Cookie Consent configuration-directory validation",
    },
  ],
};
