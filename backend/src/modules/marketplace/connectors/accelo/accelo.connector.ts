import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "accelo_selected_project_state_get",
    "Read selected project state",
    "Read only one selected project's ID, standing, paused days and lifecycle timestamps.",
  ),
];
const guards = [
  blocked(
    "accelo_private_project_data",
    "Expose private project data",
    "Titles, custom IDs, clients, contacts, managers, activities, tasks, milestones, schedules, attachments, rates, budgets, contracts, custom fields and identities are excluded.",
  ),
  blocked(
    "accelo_other_resources",
    "Read broader Accelo resources",
    "Project lists, other projects, companies, contacts, staff, prospects, tickets, retainers, time, expenses, invoices, quotes, assets and deployment data are blocked.",
  ),
  blocked(
    "accelo_mutation",
    "Mutate Accelo",
    "Projects, clients, contacts, tasks, activities, schedules, financials, progressions, attachments, configuration and every write or destructive action are blocked.",
  ),
  blocked(
    "accelo_raw_api",
    "Run arbitrary Accelo calls",
    "Agents cannot choose deployments, origins, paths, fields, filters, searches, pagination, bodies, token scopes or raw REST operations.",
  ),
];

export const ACCELO_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "accelo",
  name: "Accelo",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.accelo.com/docs/",
  providerWebsiteUrl: "https://www.accelo.com/",
  capabilities: [
    {
      ...capability(
        "accelo_selected_project_state_get",
        "Read selected project state",
        "Read bounded lifecycle metadata for one selected Accelo project.",
        true,
      ),
      platformCapability: "accelo_selected_project_state_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "ACCELO_DEPLOYMENT",
        label: "Accelo deployment prefix",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact prefix before .api.accelo.com for the customer deployment. Relay validates one DNS label and never accepts a full hostname or arbitrary origin.",
      },
      {
        name: "ACCELO_CLIENT_ID",
        label: "Service application client ID",
        required: true,
        secret: false,
        storedIn: "metadata",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated customer-owned Accelo service application configured only for the read(jobs) scope.",
      },
      {
        name: "ACCELO_CLIENT_SECRET",
        label: "Service application client secret",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Relay encrypts the matching service application secret and uses it only for deployment-bound client-credentials token requests.",
      },
      {
        name: "ACCELO_JOB_ID",
        label: "Selected project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact numeric Accelo job/project ID Relay may inspect. No project listing or agent-selected ID is exposed.",
      },
    ],
  },
  tools: [
    {
      name: "accelo.getSelectedProjectState",
      functionName: "accelo_selected_project_state_get",
      aliases: [
        "accelo.getSelectedProjectState",
        "accelo_selected_project_state_get",
        "relay_accelo_get_selected_project_state",
      ],
      capability: "accelo_selected_project_state_get",
      platformCapability: "accelo_selected_project_state_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the selected project's ID, standing, paused days and lifecycle timestamps.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "accelo_selected_project_state_read",
      label: "Selected Project State Read",
      description:
        "Read one selected project's bounded lifecycle state; private content, client data, people, financials, other resources, administration and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "accelo_no_access",
      label: "No Access",
      description: "Expose no Accelo actions.",
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
      id: "selected_project_state",
      label:
        "Accelo read(jobs) service credentials and selected-project validation",
      requiredScopes: ["read(jobs)", "selected project access only"],
    },
  ],
};
