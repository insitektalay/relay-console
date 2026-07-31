import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { ACTBLUE_MANAGE_OPERATION_IDS } from "./actblue-operation-registry";

const manage = action(
  "actblue_manage",
  "Generate or retrieve ActBlue CSV reports",
  "Create one bounded contribution report or retrieve one exact report status and short-lived signed URL; Safe mode requires approval.",
);
const dashboardAdmin = action(
  "actblue_dashboard_admin",
  "Administer ActBlue",
  "Dashboard administration, API credential creation, contribution forms and webhook configuration are not mounted.",
);
const contributionMutation = action(
  "actblue_contribution_mutation",
  "Create, refund or change contributions",
  "Relay does not mount donation processing, refunds, recurring changes or any other contribution mutation.",
);

const reportTypeSchema = {
  type: "string",
  enum: [
    "paid_contributions",
    "refunded_contributions",
    "managed_form_contributions",
    "cancelled_recurring_contributions",
  ],
};
const dateSchema = {
  type: "string",
  pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  maxLength: 10,
};

export const ACTBLUE_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "actblue",
  name: "ActBlue",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://secure.actblue.com/docs/csv_api",
  providerWebsiteUrl: "https://secure.actblue.com/",
  capabilities: [
    {
      ...capability(
        "actblue_manage",
        "Generate and retrieve contribution reports",
        "Create any of ActBlue's four credential-scoped CSV report types and retrieve one exact report status after approval.",
        true,
      ),
      platformCapability: "actblue_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ACTBLUE_CLIENT_UUID",
        label: "ActBlue client UUID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate this credential for the intended campaign or organization. Relay uses it only as the Basic-auth username on secure.actblue.com.",
      },
      {
        name: "ACTBLUE_CLIENT_SECRET",
        label: "ActBlue client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate this credential in the authorized ActBlue dashboard. Relay encrypts it and uses it only as the Basic-auth password on secure.actblue.com.",
      },
    ],
  },
  tools: [
    {
      name: "actblue.reports.generate",
      functionName: "actblue_generate_report",
      aliases: ["actblue.reports.generate", "actblue_generate_report"],
      capability: "actblue_manage",
      platformCapability: "actblue_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Generate one credential-scoped ActBlue CSV report for an exact date range.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["create_csv_report"] },
          json: {
            type: "object",
            properties: {
              csv_type: reportTypeSchema,
              date_range_start: dateSchema,
              date_range_end: dateSchema,
            },
            required: ["csv_type", "date_range_start", "date_range_end"],
            additionalProperties: false,
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation", "json"],
        additionalProperties: false,
      },
    },
    {
      name: "actblue.reports.status",
      functionName: "actblue_get_report",
      aliases: ["actblue.reports.status", "actblue_get_report"],
      capability: "actblue_manage",
      platformCapability: "actblue_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Retrieve one exact ActBlue report status and, when complete, its ten-minute signed download URL.",
      inputSchema: {
        type: "object",
        properties: {
          operation: { type: "string", enum: ["get_csv_report"] },
          pathParameters: {
            type: "object",
            properties: {
              csvId: {
                type: "string",
                pattern:
                  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
                maxLength: 36,
              },
            },
            required: ["csvId"],
            additionalProperties: false,
          },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation", "pathParameters"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "actblue_safe",
      label: "Safe",
      description:
        "Both report generation and signed-URL retrieval require approval because the resulting CSV can contain bulk political-contribution data; dashboard and contribution mutations remain blocked.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: [manage],
      blockedActions: [dashboardAdmin, contributionMutation],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `Both ${ACTBLUE_MANAGE_OPERATION_IDS.length} pinned report operations run without Relay per-action approval; fixed origin, encrypted credentials, exact report IDs, audits, provider limits and blocked administration/contribution mutations still apply.`,
      defaultSelected: false,
      allowedActions: [manage],
      approvalRequiredActions: [],
      blockedActions: [dashboardAdmin, contributionMutation],
    },
  ],
  healthChecks: [
    {
      id: "client_uuid_secret_and_entity_access",
      label:
        "ActBlue client UUID, secret and entity-scoped CSV API access check",
    },
  ],
};
