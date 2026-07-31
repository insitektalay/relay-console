import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import { MIXPANEL_COHORTS_OPERATION_IDS } from "./mixpanel-cohorts-operation-registry";

const sensitive = action(
  "mixpanel_cohorts_sensitive_read",
  "Read saved Mixpanel cohorts",
  "Read saved cohort names, descriptions, visibility, creation time, and current counts with approval.",
);
const blocks = [
  blocked(
    "mixpanel_cohorts_secret_exposure",
    "Expose credentials",
    "Service-account credentials, Basic authorization headers, project/workspace routing, and credential-bearing fields never enter agent-visible inputs or results.",
  ),
  blocked(
    "mixpanel_cohorts_member_export",
    "Read cohort members",
    "Profiles, distinct IDs, identities, properties, events, cohort members, Engage queries, exports, and raw data are excluded.",
  ),
  blocked(
    "mixpanel_cohorts_mutation",
    "Mutate Mixpanel",
    "Cohort creation/updates/deletes, profile/event/group changes, imports, reports, boards, annotations, flags, service accounts, and project administration remain provider-side.",
  ),
  blocked(
    "mixpanel_cohorts_arbitrary_api",
    "Use arbitrary APIs",
    "Only the official saved-cohort list POST runs on an enumerated US, EU, or India Query API origin with stored project/workspace binding; arbitrary input, routes, regions, auth modes, and oversized results are blocked.",
  ),
];

export const MIXPANEL_COHORTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "mixpanel-cohorts",
    name: "Mixpanel Cohorts",
    connectorType: "native_clawchat",
    providerDocsUrl: "https://developer.mixpanel.com/reference/cohorts-list",
    providerWebsiteUrl: "https://mixpanel.com/",
    capabilities: [
      {
        ...capability(
          "sensitive_read",
          "Read saved cohorts",
          "Read saved cohort metadata and current counts with approval.",
          false,
        ),
        platformCapability: "mixpanel_cohorts_sensitive_read",
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "MIXPANEL_COHORTS_SERVICE_ACCOUNT_USERNAME",
          label: "Mixpanel service-account username",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Use a dedicated project-scoped read-only service account.",
        },
        {
          name: "MIXPANEL_COHORTS_SERVICE_ACCOUNT_SECRET",
          label: "Mixpanel service-account secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Relay sends this only in Basic auth to the selected fixed Query API origin.",
        },
        {
          name: "MIXPANEL_COHORTS_REGION",
          label: "Mixpanel region",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Enter exactly us, eu, or in.",
        },
        {
          name: "MIXPANEL_COHORTS_PROJECT_ID",
          label: "Mixpanel project ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production project.",
        },
        {
          name: "MIXPANEL_COHORTS_WORKSPACE_ID",
          label: "Mixpanel workspace ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          helpText: "Bind Relay to one non-production workspace.",
        },
      ],
    },
    tools: [
      {
        name: "mixpanel-cohorts.readSensitive",
        functionName: "mixpanel_cohorts_read_sensitive",
        aliases: [
          "mixpanel-cohorts.readSensitive",
          "mixpanel_cohorts_read_sensitive",
        ],
        capability: "sensitive_read",
        platformCapability: "mixpanel_cohorts_sensitive_read",
        action: "read",
        approvalRequired: true,
        description:
          "List saved cohort metadata and current counts from one stored Mixpanel project/workspace with bounded JSON.",
        inputSchema: {
          type: "object",
          properties: {
            operation: { type: "string", enum: MIXPANEL_COHORTS_OPERATION_IDS },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["operation"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "mixpanel_cohorts_safe",
        label: "Safe",
        description:
          "The single cohort metadata/count read requires approval; exact project/workspace/region binding, response bounds, audits, and member/export/mutation blocks remain enforced.",
        defaultSelected: true,
        allowedActions: [],
        approvalRequiredActions: [sensitive],
        blockedActions: blocks,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The selected cohort metadata/count read runs without Relay per-action approval; exact project/workspace/region binding, response bounds, audits, and member/export/mutation blocks remain enforced.",
        defaultSelected: false,
        allowedActions: [sensitive],
        approvalRequiredActions: [],
        blockedActions: blocks,
      },
    ],
    healthChecks: [
      { id: "saved_cohort_list", label: "Bounded saved-cohort list" },
    ],
  };
