import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "cliniko_api_read",
  "Read Cliniko",
  "Read all current appointment, availability, patient, clinical, billing, product, practitioner, and practice data supported by the user's API key.",
);
const manage = action(
  "cliniko_api_manage",
  "Manage Cliniko",
  "Create, update, archive, cancel, unarchive, or delete records through every current non-deprecated mutation.",
);
const upload = action(
  "cliniko_attachment_upload",
  "Upload a patient attachment",
  "Complete Cliniko's presigned patient-attachment workflow without exposing temporary storage credentials.",
);
const guards = [
  action(
    "cliniko_secret_exposure",
    "Expose credentials",
    "The API key and temporary attachment-upload fields never enter agent-visible requests or results.",
  ),
  action(
    "cliniko_unofficial_origin",
    "Call another origin",
    "Every API request uses the Cliniko shard encoded in the customer's key; attachment upload accepts only Cliniko-issued HTTPS Amazon S3 targets.",
  ),
  action(
    "cliniko_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits all 196 current non-deprecated operations through 194 exact routes and one two-operation attachment workflow.",
  ),
  action(
    "cliniko_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, bodies, files, responses, redirects, nesting, and execution time.",
  ),
];
const querySchema = {
  type: "object",
  additionalProperties: {
    oneOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      {
        type: "array",
        items: {
          oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
        },
        maxItems: 100,
      },
    ],
  },
};

export const CLINIKO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "cliniko",
  name: "Cliniko",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://docs.api.cliniko.com/",
  providerWebsiteUrl: "https://www.cliniko.com/",
  capabilities: [
    {
      ...capability(
        "practice_read",
        "Read practice and clinical data",
        "Read every current Cliniko resource available to the connected user, including appointments, patients, treatment notes, forms, availability, billing, products, practitioners, and settings.",
        true,
      ),
      platformCapability: "cliniko_practice_read",
    },
    {
      ...capability(
        "practice_manage",
        "Manage practice and clinical records",
        "Use every current non-deprecated Cliniko mutation for appointments, patients, clinical records, communications, availability, products, pricing, and practice administration.",
        true,
      ),
      platformCapability: "cliniko_practice_manage",
    },
    {
      ...capability(
        "attachment_upload",
        "Upload patient attachments",
        "Upload bounded patient files through Cliniko's provider-issued storage workflow without exposing temporary credentials.",
        true,
      ),
      platformCapability: "cliniko_attachment_upload",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "CLINIKO_API_KEY",
        label: "Cliniko API key",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create a dedicated key under My info → Manage API keys. Its shard suffix selects the correct regional Cliniko API automatically.",
      },
    ],
  },
  tools: [
    {
      name: "cliniko.read",
      functionName: "cliniko_api_read",
      aliases: ["cliniko.read", "cliniko_api_read"],
      capability: "practice_read",
      platformCapability: "cliniko_practice_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one exact current non-deprecated Cliniko GET operation, excluding the attachment presign infrastructure call.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "cliniko.manage",
      functionName: "cliniko_api_manage",
      aliases: ["cliniko.manage", "cliniko_api_manage"],
      capability: "practice_manage",
      platformCapability: "cliniko_practice_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact current non-deprecated Cliniko POST, PATCH, or DELETE operation, excluding raw patient-attachment creation.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PATCH", "DELETE"] },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
    {
      name: "cliniko.upload_attachment",
      functionName: "cliniko_attachment_upload",
      aliases: ["cliniko.upload_attachment", "cliniko_attachment_upload"],
      capability: "attachment_upload",
      platformCapability: "cliniko_attachment_upload",
      action: "write",
      approvalRequired: true,
      description:
        "Upload one bounded file through Cliniko's presigned storage flow and create the patient attachment record.",
      inputSchema: {
        type: "object",
        properties: {
          patientId: { type: "string", pattern: "^[1-9][0-9]{0,19}$" },
          fileName: { type: "string", minLength: 1, maxLength: 200 },
          contentType: {
            type: "string",
            enum: ["application/pdf", "image/jpeg", "image/png", "text/plain"],
          },
          fileBase64: { type: "string", maxLength: 35000000 },
          description: { type: "string", maxLength: 5000 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["patientId", "fileName", "contentType", "fileBase64"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "cliniko_safe",
      label: "Safe",
      description:
        "All 102 current reads run directly. Every mutation and patient-attachment upload requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage, upload],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected operation runs without Relay per-action approval. Cliniko user authority, regional shard binding, exact routes, bounds, credential protection, healthcare-data controls, rate limits, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage, upload],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "current-user",
      label: "Cliniko API key and shard validation",
      requiredScopes: [],
    },
  ],
};
