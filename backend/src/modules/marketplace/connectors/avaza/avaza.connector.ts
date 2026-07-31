import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "avaza_selected_project_state_get",
    "Read selected project state",
    "Read only one selected project's ID, status flags and lifecycle dates.",
  ),
];
const guards = [
  blocked(
    "avaza_private_project_data",
    "Expose private project data",
    "Titles, codes, notes, companies, owners, sections, members, emails, rates, budgets, tags, URLs, categories, billing configuration and identities are excluded.",
  ),
  blocked(
    "avaza_other_resources",
    "Read broader Avaza resources",
    "Project lists, other projects, contacts, companies, users, tasks, schedules, timesheets, expenses, invoices, estimates, bills, payments, webhooks and account configuration are blocked.",
  ),
  blocked(
    "avaza_mutation",
    "Mutate Avaza",
    "Projects, members, tasks, schedules, time, expenses, financials, files, webhooks, configuration and every write or destructive action are blocked.",
  ),
  blocked(
    "avaza_raw_api",
    "Run arbitrary Avaza calls",
    "Agents cannot choose origins, paths, IDs, fields, filters, searches, pagination, bodies, scopes or raw REST, webhook or MCP operations.",
  ),
];

export const AVAZA_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "avaza",
  name: "Avaza",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://api.avaza.com/swagger/ui/index",
  providerWebsiteUrl: "https://www.avaza.com/",
  capabilities: [
    {
      ...capability(
        "avaza_selected_project_state_get",
        "Read selected project state",
        "Read bounded lifecycle metadata for one selected Avaza project.",
        true,
      ),
      platformCapability: "avaza_selected_project_state_get",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "AVAZA_PERSONAL_ACCESS_TOKEN",
        label: "Avaza personal access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "A dedicated customer-admin-generated Avaza personal access token granted only read_projects. Relay encrypts it and never exposes it to agents or clients.",
      },
      {
        name: "AVAZA_PROJECT_ID",
        label: "Selected project ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "The exact numeric Avaza project ID Relay may inspect. Project listing and agent-selected IDs are not exposed.",
      },
    ],
  },
  tools: [
    {
      name: "avaza.getSelectedProjectState",
      functionName: "avaza_selected_project_state_get",
      aliases: [
        "avaza.getSelectedProjectState",
        "avaza_selected_project_state_get",
        "relay_avaza_get_selected_project_state",
      ],
      capability: "avaza_selected_project_state_get",
      platformCapability: "avaza_selected_project_state_get",
      action: "read",
      approvalRequired: false,
      description:
        "Read only the selected project's ID, status flags and lifecycle dates.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "avaza_selected_project_state_read",
      label: "Selected Project State Read",
      description:
        "Read one selected project's bounded lifecycle state; private content, people, companies, financials, other resources, administration and mutations remain blocked.",
      defaultSelected: true,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions: guards,
    },
    {
      id: "avaza_no_access",
      label: "No Access",
      description: "Expose no Avaza actions.",
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
      label: "Avaza read_projects token and selected-project validation",
      requiredScopes: ["read_projects", "selected project access only"],
    },
  ],
};
