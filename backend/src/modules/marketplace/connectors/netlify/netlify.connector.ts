import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const reads = [
  action(
    "netlify_site_list",
    "List Sites",
    "List at most twenty-five Sites from the first page of one exact account.",
  ),
  action(
    "netlify_site_get",
    "Read selected Site",
    "Read one exact selected Site after account-binding verification.",
  ),
  action(
    "netlify_site_deploy_list",
    "List Site Deploys",
    "List at most twenty-five Deploys from the first page of the selected Site.",
  ),
];
const blockedActions = [
  blocked(
    "netlify_site_write",
    "Change Sites",
    "Site creation, update, disable, enable, unlink, transfer, and deletion are outside V1.",
  ),
  blocked(
    "netlify_deploy_write",
    "Change Deploys",
    "Deploy creation, upload, cancel, retry, rollback, lock, publish, and deletion are outside V1.",
  ),
  blocked(
    "netlify_private_content",
    "Read private content",
    "Environment values, deploy files and source, logs, functions, form submissions, and error messages are outside V1.",
  ),
  blocked(
    "netlify_domain_admin",
    "Manage domains",
    "Domains, DNS, certificates, aliases, and verification detail are outside V1.",
  ),
  blocked(
    "netlify_admin",
    "Administer Netlify",
    "Members, billing, audit logs, tokens, OAuth applications, hooks, add-ons, databases, and administration are outside V1.",
  ),
  blocked(
    "netlify_raw_api",
    "Use raw Netlify API",
    "Arbitrary REST, hosts, paths, queries, cursors, pagination, and raw responses are outside V1.",
  ),
];
const approvalId = { type: "string", minLength: 1, maxLength: 200 };

export const NETLIFY_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "netlify",
  name: "Netlify",
  connectorType: "native_clawchat",
  providerDocsUrl:
    "https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/",
  providerWebsiteUrl: "https://www.netlify.com/",
  capabilities: [
    {
      ...capability(
        "site_read",
        "Read Sites",
        "List bounded Sites in one exact account and inspect one selected Site.",
        true,
      ),
      platformCapability: "netlify_site_read",
    },
    {
      ...capability(
        "deploy_read",
        "Read Deploys",
        "List bounded Deploy lifecycle summaries for the selected Site.",
        true,
      ),
      platformCapability: "netlify_deploy_read",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "NETLIFY_PERSONAL_ACCESS_TOKEN",
        label: "Netlify personal access token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        helpText:
          "Create an expiring customer-owned PAT and, for SAML SSO, grant it access to the selected Team.",
      },
      {
        name: "NETLIFY_ACCOUNT_SLUG",
        label: "Netlify account slug",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Bind the connection to one exact Team or Personal Account slug.",
      },
      {
        name: "NETLIFY_SITE_ID",
        label: "Netlify Site ID",
        required: true,
        secret: false,
        storedIn: "encrypted_secret",
        helpText:
          "Bind the connection to one exact selected Site ID in that account.",
      },
    ],
  },
  tools: [
    {
      name: "netlify.listSites",
      functionName: "netlify_site_list",
      aliases: ["netlify.listSites", "netlify_site_list"],
      capability: "site_read",
      platformCapability: "netlify_site_read",
      action: "read",
      approvalRequired: true,
      description: "List a bounded first page of Sites in the bound account.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
    {
      name: "netlify.getSite",
      functionName: "netlify_site_get",
      aliases: ["netlify.getSite", "netlify_site_get"],
      capability: "site_read",
      platformCapability: "netlify_site_read",
      action: "read",
      approvalRequired: true,
      description: "Read the exact selected Site after account verification.",
      inputSchema: {
        type: "object",
        properties: { approvalId },
        additionalProperties: false,
      },
    },
    {
      name: "netlify.listDeploys",
      functionName: "netlify_site_deploy_list",
      aliases: ["netlify.listDeploys", "netlify_site_deploy_list"],
      capability: "deploy_read",
      platformCapability: "netlify_deploy_read",
      action: "read",
      approvalRequired: true,
      description:
        "List a bounded first page of Deploys for the selected Site.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 25 },
          approvalId,
        },
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "netlify_safe",
      label: "Safe",
      description:
        "All three bounded Netlify reads require matching approval because the PAT itself has broad user authority.",
      defaultSelected: true,
      allowedActions: [],
      approvalRequiredActions: reads,
      blockedActions,
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description:
        "All three selected read-only tools run without Relay per-action approval while exact account/Site binding, fixed requests, limits, redaction, audit, and provider limits remain enforced.",
      defaultSelected: false,
      allowedActions: reads,
      approvalRequiredActions: [],
      blockedActions,
    },
  ],
  healthChecks: [
    {
      id: "bound-site",
      label:
        "Netlify PAT validity, SSO Team access, exact account binding, and exact selected-Site read",
      requiredScopes: [],
    },
  ],
};
