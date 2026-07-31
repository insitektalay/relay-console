import type {
  BoundedRestConnector,
  BoundedRestOperation,
} from "../bounded-rest/bounded-rest-api.adapter";

function read(
  id: string,
  method: "GET" | "POST",
  path: string,
  bodyAllowed: boolean,
  description: string,
): BoundedRestOperation {
  return {
    id,
    method,
    path,
    pathParameters: [],
    mutating: false,
    bodyAllowed,
    description,
  };
}

/**
 * Kindful V1 deliberately requests only `basic` and `data_query`. These are
 * all documented metadata and query routes selected for those scopes; import,
 * link and integration-status writes require broader authority and are absent.
 */
export const KINDFUL_OPERATIONS = [
  read(
    "account_details",
    "GET",
    "/admin/oauth2/api/v1/details",
    false,
    "Read the connected Kindful organization's details.",
  ),
  read(
    "campaigns_list",
    "GET",
    "/admin/oauth2/api/v1/campaigns",
    false,
    "List campaigns visible to the connected Kindful organization.",
  ),
  read(
    "funds_list",
    "GET",
    "/admin/oauth2/api/v1/funds",
    false,
    "List funds visible to the connected Kindful organization.",
  ),
  read(
    "groups_list",
    "GET",
    "/admin/oauth2/api/v1/groups",
    false,
    "List contact groups and member counts.",
  ),
  read(
    "custom_fields_list",
    "GET",
    "/admin/oauth2/api/v1/custom_fields",
    false,
    "List the organization's custom fields.",
  ),
  read(
    "custom_field_groups_list",
    "GET",
    "/admin/oauth2/api/v1/custom_field_groups",
    false,
    "List the organization's custom-field groups.",
  ),
  read(
    "sync_status",
    "GET",
    "/admin/oauth2/api/v1/imports/stats",
    false,
    "Read import queue statistics and whether a synchronization can start.",
  ),
  read(
    "contacts_query",
    "POST",
    "/api/v1/contacts/query",
    true,
    "Query contacts with Kindful's documented bounded query language.",
  ),
  read(
    "transactions_query",
    "POST",
    "/api/v1/transactions/query",
    true,
    "Query transactions with Kindful's documented bounded query language.",
  ),
] as const satisfies readonly BoundedRestOperation[];

export const KINDFUL_BOUNDED_REST_CONNECTOR: BoundedRestConnector = {
  slug: "kindful",
  name: "Kindful",
  baseUrl: "https://app.kindful.com/",
  credentialName: "accessToken",
  authorization: { headerName: "Authorization", prefix: "Bearer " },
  operations: KINDFUL_OPERATIONS,
  health: { operationId: "account_details" },
};
