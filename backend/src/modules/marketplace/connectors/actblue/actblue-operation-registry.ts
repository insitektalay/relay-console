import type {
  BoundedRestConnector,
  BoundedRestOperation,
} from "../bounded-rest/bounded-rest-api.adapter";

/** Pinned from ActBlue's current official CSV API documentation on 2026-07-18. */
export const ACTBLUE_OPERATIONS = [
  {
    id: "create_csv_report",
    method: "POST",
    path: "/csvs",
    pathParameters: [],
    mutating: true,
    bodyAllowed: true,
    description: "Create one credential-scoped ActBlue CSV report.",
  },
  {
    id: "get_csv_report",
    method: "GET",
    path: "/csvs/{csvId}",
    pathParameters: ["csvId"],
    // Retrieving this resource can release a ten-minute signed bulk-export URL,
    // so Relay deliberately keeps the GET in the approval-gated manage class.
    mutating: true,
    bodyAllowed: false,
    description: "Get one ActBlue CSV report status and signed download URL.",
  },
  {
    id: "probe_csv_api",
    method: "GET",
    path: "/csvs/{csvId}",
    pathParameters: ["csvId"],
    mutating: false,
    bodyAllowed: false,
    description: "Probe authenticated CSV API access with a nonexistent UUID.",
  },
] as const satisfies readonly BoundedRestOperation[];

export const ACTBLUE_MANAGE_OPERATION_IDS = [
  "create_csv_report",
  "get_csv_report",
] as const;

export const ACTBLUE_BOUNDED_REST_CONNECTOR: BoundedRestConnector = {
  slug: "actblue",
  name: "ActBlue",
  baseUrl: "https://secure.actblue.com/api/v1/",
  basicAuthorization: {
    usernameCredentialName: "ACTBLUE_CLIENT_UUID",
    passwordCredentialName: "ACTBLUE_CLIENT_SECRET",
  },
  operations: ACTBLUE_OPERATIONS,
  health: {
    operationId: "probe_csv_api",
    input: {
      pathParameters: { csvId: "00000000-0000-0000-0000-000000000000" },
    },
    // ActBlue has no identity endpoint. A credential-authenticated lookup of a
    // nonexistent UUID returns 404 after auth and proves fixed-origin access.
    acceptedStatusCodes: [404],
  },
};
