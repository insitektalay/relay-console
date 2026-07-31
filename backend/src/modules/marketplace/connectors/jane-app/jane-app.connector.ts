import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "jane_app_api_read",
  "Read Jane App",
  "Read authorized clinic, scheduling, patient, practitioner, treatment, and medical-record data.",
);
const manage = action(
  "jane_app_api_manage",
  "Manage Jane App",
  "Create or update observations, care plans, care-plan activities, medications, and document uploads.",
);
const guards = [
  action(
    "jane_app_secret_exposure",
    "Expose credentials",
    "OAuth credentials and provider-managed webhook signing secrets never enter agent-visible requests or results.",
  ),
  action(
    "jane_app_cross_clinic_access",
    "Access another clinic",
    "Every request stays on the clinic origin bound into the practitioner OAuth token.",
  ),
  action(
    "jane_app_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits the 32 current practitioner business operations; OAuth and webhook infrastructure remain connection-owned.",
  ),
  action(
    "jane_app_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, bodies, uploads, responses, redirects, nesting, and execution time.",
  ),
];
export const JANE_APP_SCOPES = [
  "observations:read",
  "observations:create",
  "observations:update",
  "care_plans:read",
  "care_plans:create",
  "care_plans:update",
  "medications:read",
  "medications:create",
  "medications:update",
  "patients:read",
  "locations:read",
  "staff_members:read",
  "appointments:read",
  "companies:read",
  "document_uploads:read",
  "document_uploads:create",
  "disciplines:read",
  "treatments:read",
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

export const JANE_APP_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "jane-app",
  name: "Jane App",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://developers.jane.app/docs/getting-started",
  providerWebsiteUrl: "https://jane.app/",
  capabilities: [
    {
      ...capability(
        "clinical_read",
        "Read clinic and clinical data",
        "Read company, locations, staff, appointments, treatments, disciplines, patients, observations, care plans, medications, and user-owned document uploads.",
        true,
      ),
      platformCapability: "jane_app_clinical_read",
    },
    {
      ...capability(
        "clinical_manage",
        "Manage clinical records",
        "Create or update observations, care plans, activities, medications, and user-owned clinical document uploads.",
        true,
      ),
      platformCapability: "jane_app_clinical_manage",
    },
  ],
  auth: {
    type: "oauth2_authorization_code",
    oauth: {
      authorizationUrl:
        "https://login.id.janeapp.com/realms/jane/protocol/openid-connect/auth",
      tokenUrl:
        "https://login.id.janeapp.com/realms/jane/protocol/openid-connect/token",
      refreshUrl:
        "https://login.id.janeapp.com/realms/jane/protocol/openid-connect/token",
      revocationUrl:
        "https://login.id.janeapp.com/realms/jane/protocol/openid-connect/revoke",
      requiredScopes: JANE_APP_SCOPES,
      optionalScopes: [],
      pkce: true,
      supportsRefresh: true,
    },
    credentialSchema: [
      {
        name: "JANE_APP_CLIENT_ID",
        label: "Jane partner client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
      },
      {
        name: "JANE_APP_CLIENT_SECRET",
        label: "Jane partner client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
      },
    ],
  },
  tools: [
    {
      name: "jane-app.read",
      functionName: "jane_app_api_read",
      aliases: ["jane-app.read", "jane_app_api_read"],
      capability: "clinical_read",
      platformCapability: "jane_app_clinical_read",
      action: "read",
      approvalRequired: false,
      description:
        "Call one exact current Jane clinic or clinical read operation, including the POST-body patient search.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["GET", "POST"], default: "GET" },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      name: "jane-app.manage",
      functionName: "jane_app_api_manage",
      aliases: ["jane-app.manage", "jane_app_api_manage"],
      capability: "clinical_manage",
      platformCapability: "jane_app_clinical_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Call one exact current Jane clinical mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["POST", "PATCH"] },
          path: { type: "string", minLength: 1, maxLength: 500 },
          query: querySchema,
          json: { type: "object" },
          fileBase64: { type: "string", maxLength: 70000000 },
          fileName: { type: "string", maxLength: 200 },
          contentType: {
            type: "string",
            enum: ["application/pdf", "image/jpeg", "image/png"],
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["method", "path"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "jane_app_safe",
      label: "Safe",
      description:
        "Authorized reads and patient search run directly. Every clinical record or document change requires approval.",
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: guards,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "Every selected practitioner-authorized business operation runs without Relay per-action approval. Clinic and practitioner authority, exact routes, bounds, credential protection, Jane limits, healthcare-data controls, and audits still apply.",
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: guards,
    },
  ],
  healthChecks: [
    {
      id: "company",
      label: "Jane practitioner OAuth and clinic-audience validation",
      requiredScopes: JANE_APP_SCOPES,
    },
  ],
};
