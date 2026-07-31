import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";

const read = action(
  "square_appointments_api_read",
  "Read Square Appointments",
  "Read bookings, availability, booking profiles, and booking custom attributes.",
);
const manage = action(
  "square_appointments_api_manage",
  "Manage Square Appointments",
  "Create, update, or cancel bookings and manage booking custom attributes.",
);
const guards = [
  action(
    "square_appointments_secret_exposure",
    "Expose credentials",
    "OAuth credentials never enter agent-visible requests or results.",
  ),
  action(
    "square_appointments_unofficial_origin",
    "Use another API origin",
    "Every request stays on Square's production Connect API origin.",
  ),
  action(
    "square_appointments_unsupported_endpoint",
    "Call another endpoint",
    "Relay permits only the documented Bookings and Booking Custom Attributes routes.",
  ),
  action(
    "square_appointments_unbounded_transfer",
    "Run an unbounded transfer",
    "Relay bounds queries, request bodies, responses, redirects, nesting, and execution time.",
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
export const SQUARE_APPOINTMENTS_SCOPES = [
  "APPOINTMENTS_READ",
  "APPOINTMENTS_WRITE",
  "APPOINTMENTS_ALL_READ",
  "APPOINTMENTS_ALL_WRITE",
  "APPOINTMENTS_BUSINESS_SETTINGS_READ",
];

export const SQUARE_APPOINTMENTS_CONNECTOR_MANIFEST: MarketplaceConnectorManifest =
  {
    slug: "square-appointments",
    name: "Square Appointments",
    connectorType: "native_clawchat",
    providerDocsUrl:
      "https://developer.squareup.com/docs/bookings-api/what-it-does",
    providerWebsiteUrl: "https://squareup.com/appointments",
    capabilities: [
      {
        ...capability(
          "schedule_read",
          "Read appointments",
          "Read bookings, availability, business, location and team-member booking profiles, and booking custom attributes.",
          true,
        ),
        platformCapability: "square_appointments_schedule_read",
      },
      {
        ...capability(
          "schedule_manage",
          "Manage appointments",
          "Create, update, or cancel bookings and create, update, upsert, or delete booking custom attributes.",
          true,
        ),
        platformCapability: "square_appointments_schedule_manage",
      },
    ],
    auth: {
      type: "oauth2_authorization_code",
      oauth: {
        authorizationUrl: "https://connect.squareup.com/oauth2/authorize",
        tokenUrl: "https://connect.squareup.com/oauth2/token",
        refreshUrl: "https://connect.squareup.com/oauth2/token",
        revocationUrl: "https://connect.squareup.com/oauth2/revoke",
        requiredScopes: SQUARE_APPOINTMENTS_SCOPES,
        optionalScopes: [],
        pkce: false,
        supportsRefresh: true,
      },
      credentialSchema: [
        {
          name: "SQUARE_APPOINTMENTS_CLIENT_ID",
          label: "Square application ID",
          required: true,
          secret: false,
          storedIn: "metadata",
        },
        {
          name: "SQUARE_APPOINTMENTS_CLIENT_SECRET",
          label: "Square application secret",
          required: true,
          secret: true,
          storedIn: "encrypted_secret",
        },
      ],
    },
    tools: [
      {
        name: "square-appointments.read",
        functionName: "square_appointments_api_read",
        aliases: ["square-appointments.read", "square_appointments_api_read"],
        capability: "schedule_read",
        platformCapability: "square_appointments_schedule_read",
        action: "read",
        approvalRequired: false,
        description:
          "Call one exact documented Square Bookings read or read-like search operation.",
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
        name: "square-appointments.manage",
        functionName: "square_appointments_api_manage",
        aliases: [
          "square-appointments.manage",
          "square_appointments_api_manage",
        ],
        capability: "schedule_manage",
        platformCapability: "square_appointments_schedule_manage",
        action: "write",
        approvalRequired: true,
        description:
          "Call one exact documented Square booking or booking-custom-attribute mutation; Safe mode requires approval.",
        inputSchema: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["POST", "PUT", "DELETE"] },
            path: { type: "string", minLength: 1, maxLength: 500 },
            query: querySchema,
            json: { type: "object" },
            approvalId: { type: "string", maxLength: 200 },
          },
          required: ["method", "path"],
          additionalProperties: false,
        },
      },
    ],
    approvalProfiles: [
      {
        id: "square_appointments_safe",
        label: "Safe",
        description:
          "Bookings, availability, profiles, and custom-attribute reads run directly. Every booking or custom-attribute change requires approval.",
        defaultSelected: true,
        allowedActions: [read],
        approvalRequiredActions: [manage],
        blockedActions: guards,
      },
      {
        id: "dangerously_skip_permissions",
        label: "Dangerously skip permissions",
        description:
          "Every selected operation authorized by the connected Square seller runs without Relay per-action approval. Seller authority, exact routes, request bounds, credential protection, Square limits, and audits still apply.",
        defaultSelected: false,
        allowedActions: [read, manage],
        approvalRequiredActions: [],
        blockedActions: guards,
      },
    ],
    healthChecks: [
      {
        id: "business-booking-profile",
        label: "Square OAuth token and booking-business validation",
      },
    ],
  };
