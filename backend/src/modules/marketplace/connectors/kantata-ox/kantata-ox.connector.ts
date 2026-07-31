import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "kantata_ox_selected_workspace_state_get",
    "Read selected project state",
    "Read only one selected project's ID, stage, archive state and schedule dates.",
  ),
];
const guards = [
  blocked(
    "kantata_ox_private_project_data",
    "Expose private project data",
    "Titles, descriptions, posts, tasks, files, custom fields, participants, clients, organizations, financials and identities are excluded from Relay output.",
  ),
  blocked(
    "kantata_ox_other_resources",
    "Read broader Kantata OX resources",
    "Project lists, other projects, users, resources, allocations, time, expenses, invoices, reports, templates, events and account data are blocked.",
  ),
  blocked(
    "kantata_ox_mutation",
    "Mutate Kantata OX",
    "Projects, tasks, posts, files, users, resources, schedules, time, expenses, invoices, permissions, settings and every write or destructive action are blocked.",
  ),
  blocked(
    "kantata_ox_raw_api",
    "Run arbitrary Kantata OX calls",
    "Agents cannot choose API origins, paths, includes, filters, optional fields, pagination, bodies or raw REST operations.",
  ),
  blocked(
    "kantata_ox_duplicate_mavenlink",
    "Create a separate Mavenlink connection",
    "Mavenlink is the former product name and must resolve to this single Kantata OX authority, credential, policy and lifecycle.",
  ),
];

export const KANTATA_OX_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "kantata-ox",
  name: "Kantata OX",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://developer.kantata.com/kantata/specification/workspaces",
  providerWebsiteUrl: "https://www.kantata.com/kantata-ox",
  capabilities: [
    {
      ...capability(
        "kantata_ox_selected_workspace_state_get",
        "Read selected project state",
        "Read bounded lifecycle metadata for one selected Kantata OX project.",
        true,
      ),
      platformCapability: "kantata_ox_selected_workspace_state_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "KANTATA_OX_OAUTH_TOKEN",
        label: "Customer-generated OAuth bearer token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A non-expiring OAuth bearer token generated from a customer-owned Kantata OX application. Railway encrypts it and uses it only for the fixed selected-project read; revoke the application to invalidate it.",
      },
      {
        name: "KANTATA_OX_WORKSPACE_ID",
        label: "Selected project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact numeric Kantata workspace/project ID Relay may inspect. The token user must have access to this project and no broader authority than the customer requires.",
      },
    ],
  },
  tools: [
    {
      name: "kantataOx.getSelectedWorkspaceState",
      functionName: "kantata_ox_selected_workspace_state_get",
      aliases: [
        "kantataOx.getSelectedWorkspaceState",
        "kantata_ox_selected_workspace_state_get",
        "relay_kantata_ox_get_selected_workspace_state",
      ],
      capability: "kantata_ox_selected_workspace_state_get",
      platformCapability: "kantata_ox_selected_workspace_state_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the selected project's ID, stage, archive state and schedule dates.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "kantata_ox_selected_workspace_state_read",
      label: "Selected Project State Read",
      description:
        "Read one selected project's bounded lifecycle state; private content, financials, identities, other resources, administration and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "kantata_ox_no_access",
      label: "No Access",
      description: "Expose no Kantata OX actions.",
      defaultSelected: false,
      allowedActions: [],
      approvalRequiredActions: [],
      blockedActions: [
        ...reads.map((item) =>
          blocked(item.id, item.label, "Blocked by authority preset."),
        ),
        ...guards,
      ],
    },
  ],
  healthChecks: [
    {
      id: "selected_workspace_state",
      label: "Kantata OX OAuth token and selected-project validation",
      requiredScopes: [
        "customer-owned OAuth bearer token",
        "selected project access only",
      ],
    },
  ],
};
