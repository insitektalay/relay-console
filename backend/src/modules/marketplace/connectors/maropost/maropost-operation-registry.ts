export type MaropostOperation = {
  id: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
  pathParameters: string[];
  queryParameters: string[];
};

export const MAROPOST_OPERATIONS: MaropostOperation[] = [
  {
    id: "list_campaigns",
    method: "GET",
    path: "/v2/{accountId}/campaigns.json",
    policy: "structural_read",
    pathParameters: [],
    queryParameters: ["name", "include_ab_child", "per_page", "page"],
  },
  {
    id: "get_campaign",
    method: "GET",
    path: "/accounts/{accountId}/campaigns/{campaignId}.json",
    policy: "sensitive_read",
    pathParameters: ["campaignId"],
    queryParameters: [],
  },
  {
    id: "get_contact_by_email",
    method: "GET",
    path: "/accounts/{accountId}/contacts/email.json",
    policy: "sensitive_read",
    pathParameters: [],
    queryParameters: ["email", "uid"],
  },
  {
    id: "upsert_contact_in_list",
    method: "POST",
    path: "/accounts/{accountId}/lists/{listId}/contacts.json",
    policy: "manage",
    pathParameters: ["listId"],
    queryParameters: [],
  },
  {
    id: "update_contact_in_list",
    method: "PUT",
    path: "/accounts/{accountId}/lists/{listId}/contacts/{contactId}.json",
    policy: "manage",
    pathParameters: ["listId", "contactId"],
    queryParameters: [],
  },
];

export const MAROPOST_OPERATION_BY_ID = new Map(
  MAROPOST_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const MAROPOST_STRUCTURAL_READ_OPERATION_IDS =
  MAROPOST_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const MAROPOST_SENSITIVE_READ_OPERATION_IDS = MAROPOST_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const MAROPOST_MANAGE_OPERATION_IDS = MAROPOST_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
