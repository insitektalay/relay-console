import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const sendActions = [
  action(
    "hightail_send_files",
    "Send files",
    "Upload one bounded set of files and send it to explicitly named recipients; Safe mode requires approval.",
  ),
];

export const HIGHTAIL_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "hightail",
  name: "Hightail",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developer.hightail.com/",
  providerWebsiteUrl: "https://www.hightail.com/",
  capabilities: [
    {
      ...capability(
        "file_send",
        "Send large files",
        "Upload bounded files to a Hightail Send and notify explicitly selected recipients with the chosen delivery controls.",
        true,
      ),
      platformCapability: "hightail_file_send",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "HIGHTAIL_API_TOKEN",
        label: "Hightail API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Ask your Hightail Teams or Business administrator for a production API token.",
      },
      {
        name: "HIGHTAIL_SENDER_EMAIL",
        label: "Sender email",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Enter the Hightail user email in the same organization as the API token.",
      },
    ],
  },
  tools: [
    {
      name: "hightail.sendFiles",
      functionName: "hightail_send_files",
      aliases: ["hightail.sendFiles", "hightail_send_files"],
      capability: "file_send",
      platformCapability: "hightail_file_send",
      action: "write",
      approvalRequired: true,
      description:
        "Create, upload, and submit one bounded Hightail Send without exposing the API token or provider-signed upload URLs.",
      inputSchema: {
        type: "object",
        properties: {
          files: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                filename: { type: "string", minLength: 1, maxLength: 255 },
                contentBase64: {
                  type: "string",
                  minLength: 1,
                  maxLength: 7_000_000,
                },
              },
              required: ["filename", "contentBase64"],
              additionalProperties: false,
            },
          },
          recipients: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            uniqueItems: true,
            items: { type: "string", minLength: 3, maxLength: 320 },
          },
          subject: { type: "string", maxLength: 500 },
          message: { type: "string", maxLength: 5_000 },
          sendEmail: { type: "boolean" },
          sendReceiptRequested: { type: "boolean" },
          downloadReceiptRequested: { type: "boolean" },
          verifyRecipient: { type: "boolean" },
          allowComment: { type: "boolean" },
          preventDownload: { type: "boolean" },
          expiresAt: { type: "integer", minimum: 1 },
          accessCode: { type: "string", minLength: 1, maxLength: 100 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["files", "recipients"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "hightail_safe",
      label: "Safe",
      description:
        "Hightail sends require approval because they upload content and can notify external recipients.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: sendActions,
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Selected Hightail sends run without Relay per-action approval; ownership, recipient and payload bounds, fixed provider origins, token secrecy, audits, and Hightail plan limits still apply.",
      defaultSelected: false,
      allowedActions: sendActions,
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    {
      id: "credential-presence",
      label: "Hightail token and sender validation",
    },
  ],
};
