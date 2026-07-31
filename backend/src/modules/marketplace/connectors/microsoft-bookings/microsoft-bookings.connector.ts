import {
  action,
  blocked,
  capability,
} from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

export const MICROSOFT_BOOKINGS_SCOPES = [
  "https://graph.microsoft.com/Bookings.Read.All",
];
const reads = [
  action(
    "microsoft_bookings_business_get",
    "Get selected business",
    "Read privacy-bounded metadata for the connection-selected Bookings business.",
  ),
  action(
    "microsoft_bookings_services_list",
    "List services",
    "List at most twenty-five services for the selected Bookings business.",
  ),
  action(
    "microsoft_bookings_service_get",
    "Get service",
    "Read one explicit prior-result service without notes, staff, or custom questions.",
  ),
  action(
    "microsoft_bookings_calendar_view",
    "View schedule metadata",
    "Read privacy-scrubbed appointment metadata for an explicit range of at most seven days.",
  ),
];
const blockedActions = [
  blocked(
    "microsoft_bookings_customers_staff",
    "Read customers or staff",
    "Customer records, staff records, identities, contact data, and availability are outside V1.",
  ),
  blocked(
    "microsoft_bookings_customer_contact_notes",
    "Read private appointment content",
    "Customer names, emails, phones, time zones, notes, answers, reminders, and additional information are outside V1.",
  ),
  blocked(
    "microsoft_bookings_join_urls",
    "Read meeting or location details",
    "Join URLs, meeting links, locations, and appointment instructions are outside V1.",
  ),
  blocked(
    "microsoft_bookings_appointment_detail",
    "Read raw appointment details",
    "Raw appointment detail, custom questions, and arbitrary expansions are outside V1.",
  ),
  blocked(
    "microsoft_bookings_mutations_cancel",
    "Change Bookings resources",
    "Create, update, cancel, delete, publish, and other mutations are outside V1.",
  ),
  blocked(
    "microsoft_bookings_application_write_scopes",
    "Use broad Bookings permissions",
    "Application permissions and Bookings write or manage scopes are outside V1.",
  ),
  blocked(
    "microsoft_bookings_raw_beta_export_pagination",
    "Use raw or bulk access",
    "Business discovery, beta or raw endpoints, arbitrary OData, exports, retries, polling, and automatic pagination are outside V1.",
  ),
];
const id = { type: "string", pattern: "^[A-Za-z0-9._@!~=-]{1,512}$" };
const instant = { type: "string", format: "date-time" };

export const MICROSOFT_BOOKINGS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "microsoft-bookings",
    name: "Microsoft Bookings",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://learn.microsoft.com/graph/api/resources/booking-api-overview",
    providerWebsiteUrl:
      "https://www.microsoft.com/microsoft-365/business/scheduling-and-booking-app",
    capabilities: [
      {
        ...capability(
          "business_services",
          "Read business and services",
          "Review one selected Bookings business and its bounded service catalog.",
          true,
        ),
        platformCapability: "microsoft_bookings_business_services_read",
      },
      {
        ...capability(
          "calendar_view",
          "Read schedule metadata",
          "Review up to seven days of privacy-scrubbed occupied schedule metadata.",
          true,
        ),
        platformCapability: "microsoft_bookings_calendar_view_read",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
        tokenUrl:
          "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
        authority: {
          provider: "microsoft",
          defaultMode: "multi_tenant_org",
          tenantIdEnv: "MICROSOFT_TENANT_ID",
        },
        requiredScopes: MICROSOFT_BOOKINGS_SCOPES,
        optionalScopes: [],
        pkce: true,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "MICROSOFT_CLIENT_ID",
          label: "Microsoft application client ID",
          required: true,
          secret: false,
          storedIn: "metadata",
          requiredForAuthTypes: ["oauth"],
          helpText:
            "Relay-owned Entra application ID configured only on Railway.",
        },
        {
          name: "MICROSOFT_CLIENT_SECRET",
          label: "Microsoft application client secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
          requiredForAuthTypes: ["oauth"],
          helpText: "Relay-owned Entra secret retained only by Railway.",
        },
      ],
    },
    tools: [
      {
        name: "microsoft-bookings.getBusiness",
        functionName: "microsoft_bookings_business_get",
        aliases: [
          "microsoft-bookings.getBusiness",
          "relay_microsoft_bookings_get_business",
        ],
        capability: "business_services",
        platformCapability: "microsoft_bookings_business_services_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read privacy-bounded metadata for the selected Bookings business.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-bookings.listServices",
        functionName: "microsoft_bookings_services_list",
        aliases: [
          "microsoft-bookings.listServices",
          "relay_microsoft_bookings_list_services",
        ],
        capability: "business_services",
        platformCapability: "microsoft_bookings_business_services_read",
        action: "read",
        approvalRequired: false,
        description:
          "List at most twenty-five services for the selected Bookings business.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-bookings.getService",
        functionName: "microsoft_bookings_service_get",
        aliases: [
          "microsoft-bookings.getService",
          "relay_microsoft_bookings_get_service",
        ],
        capability: "business_services",
        platformCapability: "microsoft_bookings_business_services_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read one explicit prior-result service without sensitive fields.",
        inputSchema: {
          type: "object",
          properties: { serviceId: id },
          required: ["serviceId"],
          additionalProperties: false,
        },
      },
      {
        name: "microsoft-bookings.calendarView",
        functionName: "microsoft_bookings_calendar_view",
        aliases: [
          "microsoft-bookings.calendarView",
          "relay_microsoft_bookings_calendar_view",
        ],
        capability: "calendar_view",
        platformCapability: "microsoft_bookings_calendar_view_read",
        action: "read",
        approvalRequired: false,
        description:
          "Read privacy-scrubbed appointment metadata for an explicit range of at most seven days.",
        inputSchema: {
          type: "object",
          properties: { start: instant, end: instant },
          required: ["start", "end"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "microsoft_bookings_safe",
        label: "Safe",
        description:
          "Four selected-business privacy-scrubbed reads run automatically; customers, staff, private content, meeting details, writes, broad permissions, discovery, pagination, beta, and raw Graph remain blocked.",
        defaultSelected: true,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "The same four selected-business reads run without Relay per-action approval; exact scope, business binding, limits, scrubbing, audit, and Microsoft controls still apply.",
        defaultSelected: false,
        allowedActions: reads,
        approvalRequiredActions: [],
        blockedActions,
      },
    ],
    healthChecks: [
      {
        id: "selected_business",
        label:
          "Microsoft work-account authorization, exact scope, refresh, and selected Bookings business validation",
        requiredScopes: MICROSOFT_BOOKINGS_SCOPES,
      },
    ],
  };
