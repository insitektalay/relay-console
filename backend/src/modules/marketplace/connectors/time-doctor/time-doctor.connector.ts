import { action, capability } from "../../catalog/marketplace-catalog.types";
import type { MarketplaceConnectorManifest } from "../types";
import {
  TIME_DOCTOR_MANAGE_OPERATION_IDS,
  TIME_DOCTOR_OPERATIONS,
  TIME_DOCTOR_READ_OPERATION_IDS,
} from "./time-doctor-operation-registry";

const read = action(
  "time_doctor_read",
  "Read Time Doctor",
  "Read bounded activity, time, reports, companies, projects, tasks, people, schedules, notifications, payroll, approvals, and software-cost data.",
);
const manage = action(
  "time_doctor_manage",
  "Manage Time Doctor",
  "Create, update, assign, invite, subscribe, approve, or delete authorized Time Doctor records; Safe mode requires approval.",
);

export const TIME_DOCTOR_CONNECTOR_MANIFEST: MarketplaceConnectorManifest = {
  slug: "time-doctor",
  name: "Time Doctor",
  connectorType: "native_clawchat",
  providerDocsUrl: "https://timedoctor.redoc.ly/",
  providerWebsiteUrl: "https://www.timedoctor.com/",
  capabilities: [
    {
      ...capability(
        "time_doctor_read",
        "Read time and workforce data",
        `Use all ${TIME_DOCTOR_READ_OPERATION_IDS.length} pinned reads for activity, time reports, companies, projects, tasks, people, schedules, notifications, payroll, approvals, calendar data, and software costs.`,
        true,
      ),
      platformCapability: "time_doctor_read",
    },
    {
      ...capability(
        "time_doctor_manage",
        "Manage time and workforce data",
        `Use all ${TIME_DOCTOR_MANAGE_OPERATION_IDS.length} pinned mutations for time edits, projects, tasks, people, groups, schedules, notifications, breaks, payroll, approvals, calendar sync, and software costs.`,
        true,
      ),
      platformCapability: "time_doctor_manage",
    },
  ],
  auth: {
    type: "api_key",
    credentialSchema: [
      {
        name: "TIME_DOCTOR_JWT_TOKEN",
        label: "Time Doctor API token",
        required: true,
        secret: true,
        storedIn: "encrypted_secret",
        requiredForAuthTypes: ["api_key"],
        helpText:
          "Generate a token using Time Doctor's official API login flow, then paste only the token here. Relay encrypts it and sends it only to api2.timedoctor.com.",
      },
    ],
  },
  tools: [
    {
      name: "timeDoctor.read",
      functionName: "time_doctor_read",
      aliases: ["timeDoctor.read", "time_doctor_read"],
      capability: "time_doctor_read",
      platformCapability: "time_doctor_read",
      action: "read",
      approvalRequired: false,
      description:
        "Run one pinned Time Doctor GET operation with bounded arguments and results.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...TIME_DOCTOR_READ_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 50 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
    {
      name: "timeDoctor.manage",
      functionName: "time_doctor_manage",
      aliases: ["timeDoctor.manage", "time_doctor_manage"],
      capability: "time_doctor_manage",
      platformCapability: "time_doctor_manage",
      action: "write",
      approvalRequired: true,
      description:
        "Run one pinned Time Doctor mutation; Safe mode requires approval.",
      inputSchema: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [...TIME_DOCTOR_MANAGE_OPERATION_IDS],
          },
          pathParameters: { type: "object", maxProperties: 10 },
          query: { type: "object", maxProperties: 50 },
          json: { type: "object", maxProperties: 500 },
          approvalId: { type: "string", maxLength: 200 },
        },
        required: ["operation"],
        additionalProperties: false,
      },
    },
  ],
  approvalProfiles: [
    {
      id: "time_doctor_safe",
      label: "Safe",
      description: `All ${TIME_DOCTOR_READ_OPERATION_IDS.length} bounded reads run directly; every mutation requires approval.`,
      defaultSelected: true,
      allowedActions: [read],
      approvalRequiredActions: [manage],
      blockedActions: [],
    },
    {
      id: "dangerously_skip_permissions",
      label: "Dangerously skip permissions",
      description: `All ${TIME_DOCTOR_OPERATIONS.length} selected and token-authorized operations run without Relay per-action approval; ownership, exact routes, bounds, audits, redaction, rate limits, and Time Doctor permissions still apply.`,
      defaultSelected: false,
      allowedActions: [read, manage],
      approvalRequiredActions: [],
      blockedActions: [],
    },
  ],
  healthChecks: [
    { id: "companies", label: "Time Doctor account and company access" },
  ],
};
