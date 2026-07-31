import { action, blocked, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

type EhrProviderConfig = {
  slug: string;
  name: string;
  docsUrl: string;
  websiteUrl: string;
  setupLabel: string;
};

const reads = [
  action(
    "ehr_fhir_discovery_read",
    "Read SMART/FHIR discovery",
    "Read the connected tenant's SMART configuration and FHIR CapabilityStatement without patient chart payloads.",
  ),
  action(
    "ehr_fhir_metadata_search",
    "Search FHIR metadata",
    "Search allowlisted FHIR R4 resources with Relay-bounded query parameters and content-minimized results.",
  ),
  action(
    "ehr_fhir_metadata_read",
    "Read FHIR resource metadata",
    "Read one exact allowlisted FHIR R4 resource through Relay's content-minimized projection.",
  ),
];

const guards = [
  blocked(
    "ehr_raw_chart_exposure",
    "Expose raw chart content",
    "FHIR narratives, notes, attachments, values, addresses, telecom fields, names, identifiers, and raw records are not sent to agents.",
  ),
  blocked(
    "ehr_patient_portal_credentials",
    "Collect portal credentials",
    "Relay never collects patient portal usernames, passwords, passkeys, MFA codes, activation codes, cookies, or browser sessions.",
  ),
  blocked(
    "ehr_fhir_write",
    "Mutate clinical records",
    "Creates, updates, deletes, bulk export, messaging, ordering, scheduling mutation, and administrative EHR actions are outside this V1.",
  ),
];

export function ehrFhirConnector(config: EhrProviderConfig): MarketplaceConnectorManifest {
  return {
    slug: config.slug,
    name: config.name,
    connectorType: "native_clawchat",
    providerDocsUrl: config.docsUrl,
    providerWebsiteUrl: config.websiteUrl,
    capabilities: [
      {
        ...capability(
          "ehr_fhir_read",
          "Read SMART/FHIR metadata",
          "Inspect tenant discovery and content-minimized metadata for allowlisted FHIR R4 resources without exposing raw protected health information.",
          true,
        ),
        platformCapability: `${config.slug.replaceAll("-", "_")}_ehr_fhir_read`,
      },
    ],
    auth: {
      type: "api_key",
      credentialSchema: [
        {
          name: "EHR_FHIR_BASE_URL",
          label: `${config.name} FHIR base URL`,
          required: true,
          secret: false,
          storedIn: "encrypted_secret",
          helpText:
            "Use the HTTPS FHIR R4 base URL for the exact authorized tenant or sandbox.",
        },
        {
          name: "EHR_FHIR_ACCESS_TOKEN",
          label: `${config.name} SMART/FHIR bearer token`,
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          helpText:
            "Use an authorized, revocable SMART/FHIR token from the customer/provider-approved app registration.",
        },
      ],
    },
    tools: [
      {
        name: `${config.slug}.discovery`,
        functionName: "ehr_fhir_discovery_read",
        aliases: [`${config.slug}.discovery`, `${config.slug}_discovery`],
        capability: "ehr_fhir_read",
        platformCapability: `${config.slug.replaceAll("-", "_")}_ehr_fhir_read`,
        action: "read",
        approvalRequired: false,
        description:
          "Read SMART configuration and FHIR CapabilityStatement for the connected HTTPS FHIR base.",
        inputSchema: { type: "object", additionalProperties: false },
      },
      {
        name: `${config.slug}.search`,
        functionName: "ehr_fhir_metadata_search",
        aliases: [`${config.slug}.search`, `${config.slug}_search`],
        capability: "ehr_fhir_read",
        platformCapability: `${config.slug.replaceAll("-", "_")}_ehr_fhir_read`,
        action: "read",
        approvalRequired: true,
        description:
          "Search one allowlisted FHIR R4 resource and return only content-minimized metadata, capped at twenty-five resources.",
        inputSchema: {
          type: "object",
          properties: {
            resourceType: {
              type: "string",
              enum: [
                "AllergyIntolerance",
                "Appointment",
                "CarePlan",
                "Condition",
                "DiagnosticReport",
                "DocumentReference",
                "Encounter",
                "Immunization",
                "Location",
                "MedicationRequest",
                "Observation",
                "Organization",
                "Patient",
                "Practitioner",
                "Procedure",
              ],
            },
            query: { type: "object", maxProperties: 25 },
          },
          required: ["resourceType"],
          additionalProperties: false,
        },
      },
      {
        name: `${config.slug}.read`,
        functionName: "ehr_fhir_metadata_read",
        aliases: [`${config.slug}.read`, `${config.slug}_read`],
        capability: "ehr_fhir_read",
        platformCapability: `${config.slug.replaceAll("-", "_")}_ehr_fhir_read`,
        action: "read",
        approvalRequired: true,
        description:
          "Read one exact allowlisted FHIR R4 resource through Relay's content-minimized projection.",
        inputSchema: {
          type: "object",
          properties: {
            resourceType: { type: "string" },
            id: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9.-]{0,127}$" },
          },
          required: ["resourceType", "id"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: `${config.slug.replaceAll("-", "_")}_safe`,
        label: "Safe",
        description:
          "Discovery runs directly. FHIR resource searches and reads require approval and return only content-minimized metadata.",
        defaultSelected: true,
        allowedActions: [reads[0]],
        approvalRequiredActions: [reads[1], reads[2]],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Selected read operations run without Relay per-action approval; tenant binding, SMART/FHIR scopes, content minimization, bounds, audits, and token secrecy still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "smart_fhir_discovery",
        label: `${config.setupLabel} SMART/FHIR base URL and bearer-token validation`,
      },
    ],
  };
}

export const CERNER_ORACLE_HEALTH_CONNECTOR_MANIFEST = ehrFhirConnector({
  slug: "cerner-oracle-health",
  name: "Cerner Oracle Health",
  docsUrl: "https://docs.oracle.com/en/industries/health/millennium-platform-apis/",
  websiteUrl: "https://www.oracle.com/health/",
  setupLabel: "Oracle Health Millennium",
});

export const EPIC_APP_ORCHARD_CONNECTOR_MANIFEST = ehrFhirConnector({
  slug: "epic-app-orchard",
  name: "Epic App Orchard",
  docsUrl: "https://fhir.epic.com/Documentation?docid=implementing&section=interfacesetupforapps",
  websiteUrl: "https://open.epic.com/",
  setupLabel: "Epic on FHIR",
});

export const MEDITECH_EXPANSE_CONNECTOR_MANIFEST = ehrFhirConnector({
  slug: "meditech-expanse",
  name: "Meditech Expanse",
  docsUrl: "https://ehr.meditech.com/ehr-solutions/how-to-work-in-the-greenfield-workspace",
  websiteUrl: "https://ehr.meditech.com/ehr-solutions/greenfield-workspace",
  setupLabel: "Meditech Greenfield Workspace",
});

export const ECLINICALWORKS_CONNECTOR_MANIFEST = ehrFhirConnector({
  slug: "eclinicalworks",
  name: "eClinicalWorks",
  docsUrl: "https://www.eclinicalworks.com/products-services/interoperability/",
  websiteUrl: "https://www.eclinicalworks.com/",
  setupLabel: "eClinicalWorks FHIR",
});

export const NEXTGEN_HEALTHCARE_CONNECTOR_MANIFEST = ehrFhirConnector({
  slug: "nextgen-healthcare",
  name: "NextGen Healthcare",
  docsUrl: "https://www.nextgen.com/api",
  websiteUrl: "https://www.nextgen.com/",
  setupLabel: "NextGen FHIR",
});

export const EHR_FHIR_CONNECTOR_SLUGS = new Set([
  CERNER_ORACLE_HEALTH_CONNECTOR_MANIFEST.slug,
  EPIC_APP_ORCHARD_CONNECTOR_MANIFEST.slug,
  MEDITECH_EXPANSE_CONNECTOR_MANIFEST.slug,
  ECLINICALWORKS_CONNECTOR_MANIFEST.slug,
  NEXTGEN_HEALTHCARE_CONNECTOR_MANIFEST.slug,
]);
