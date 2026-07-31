import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "filestack_download_file",
    "Download file",
    "Download one Filestack file up to Relay's five-megabyte agent response limit.",
  ),
  action(
    "filestack_read_metadata",
    "Read file metadata",
    "Read bounded metadata, including optional EXIF data, for one Filestack handle.",
  ),
];

const writes = [
  action(
    "filestack_upload_file",
    "Upload file",
    "Upload one file up to five megabytes; Safe mode requires approval.",
  ),
  action(
    "filestack_overwrite_file",
    "Overwrite file",
    "Replace the content behind one explicit Filestack handle; Safe mode requires approval.",
  ),
  action(
    "filestack_delete_file",
    "Delete file",
    "Permanently delete one explicit Filestack handle; Safe mode requires approval.",
  ),
  action(
    "filestack_process_file",
    "Process file",
    "Run one bounded Filestack Processing API task chain; Safe mode requires approval.",
  ),
  action(
    "filestack_run_workflow",
    "Run workflow",
    "Run one configured Filestack workflow on one explicit handle; Safe mode requires approval.",
  ),
];

const blocked = [
  action(
    "filestack_secret_exposure",
    "Expose signing credentials",
    "The application secret, generated policy, and signature never enter agent-visible results.",
  ),
  action(
    "filestack_unbounded_transfer",
    "Transfer an unbounded file",
    "Agent upload, download, and processing payloads are limited to five megabytes.",
  ),
  action(
    "filestack_untrusted_origin",
    "Call an alternate origin",
    "File and Processing API requests remain pinned to documented Filestack HTTPS origins.",
  ),
];

const handleProperty = {
  type: "string",
  minLength: 2,
  maxLength: 128,
  pattern: "^[A-Za-z0-9_-]+$",
};
const fileProperties = {
  filename: { type: "string", minLength: 1, maxLength: 255 },
  contentBase64: { type: "string", minLength: 1, maxLength: 7_000_000 },
  contentType: { type: "string", maxLength: 200 },
};

export const FILESTACK_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "filestack",
  name: "Filestack",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://www.filestack.com/docs/",
  providerWebsiteUrl: "https://www.filestack.com/",
  capabilities: [
    {
      ...capability(
        "file_read",
        "Read files",
        "Download bounded file content and inspect metadata or EXIF data for an explicit Filestack handle.",
        true,
      ),
      platformCapability: "filestack_file_read",
    },
    {
      ...capability(
        "file_manage",
        "Manage files",
        "Upload new files, overwrite existing handles, and permanently delete explicitly selected files.",
        true,
      ),
      platformCapability: "filestack_file_manage",
    },
    {
      ...capability(
        "file_process",
        "Process files",
        "Run documented Processing API task chains and customer-configured workflows against explicit handles.",
        true,
      ),
      platformCapability: "filestack_file_process",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "FILESTACK_API_KEY",
        label: "Filestack API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the application API key from your Filestack Developer Portal.",
      },
      {
        name: "FILESTACK_APP_SECRET",
        label: "Filestack app secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Copy the application secret from Security in your Filestack Developer Portal. Relay uses it only on Railway to sign short-lived policies.",
      },
    ],
  },
  tools: [
    {
      name: "filestack.read",
      functionName: "filestack_read",
      aliases: ["filestack.read", "filestack_read"],
      capability: "file_read",
      platformCapability: "filestack_file_read",
      action: "read",
      approvalRequired: false,
      description:
        "Download bounded file content or read metadata for one explicit Filestack handle without exposing signed policy credentials.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["download_file", "read_metadata"],
          },
          handle: handleProperty,
          includeExif: { type: "boolean" },
        },
        required: ["operation", "handle"],
        additionalProperties: false,
      },
    },
    {
      name: "filestack.manage",
      functionName: "filestack_manage",
      aliases: ["filestack.manage", "filestack_manage"],
      capability: "file_manage",
      platformCapability: "filestack_file_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Upload, overwrite, or delete one bounded Filestack file using a server-generated operation-scoped policy.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["upload_file", "overwrite_file", "delete_file"],
          },
          handle: handleProperty,
          ...fileProperties,
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "filestack.process",
      functionName: "filestack_process",
      aliases: ["filestack.process", "filestack_process"],
      capability: "file_process",
      platformCapability: "filestack_file_process",
      action: "write",
      approvalRequired: true,
      description:
        "Run one bounded documented Filestack Processing API task chain against an explicit handle.",
      inputSchema: {
        type: "object",
        properties: {
          handle: handleProperty,
          taskChain: { type: "string", minLength: 1, maxLength: 1000 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["handle", "taskChain"],
        additionalProperties: false,
      },
    },
    {
      name: "filestack.runWorkflow",
      functionName: "filestack_run_workflow",
      aliases: ["filestack.runWorkflow", "filestack_run_workflow"],
      capability: "file_process",
      platformCapability: "filestack_file_process",
      action: "write",
      approvalRequired: true,
      description:
        "Run one workflow already configured in the customer's Filestack Developer Portal against an explicit handle.",
      inputSchema: {
        type: "object",
        properties: {
          handle: handleProperty,
          workflowId: {
            type: "string",
            minLength: 2,
            maxLength: 128,
            pattern: "^[A-Za-z0-9_-]+$",
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["handle", "workflowId"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "filestack_safe",
      label: "Safe",
      description:
        "Bounded downloads and metadata reads run directly; uploads, overwrites, deletion, processing, and workflows require approval.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: writes,
      blockedActions: blocked,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected Filestack operation runs without Relay per-action approval; ownership, fixed provider origins, payload bounds, short-lived scoped signatures, secret redaction, audits, account security, add-ons, and provider limits still apply.",
      defaultSelected: false,
      allowedActions: [...reads, ...writes],
      approvalRequiredActions: [],
      blockedActions: blocked,
    },
  ],
  healthChecks: [
    {
      id: "credential-presence",
      label: "Filestack application credential validation",
    },
  ],
};
