export type ListrakOperation = {
  id: string;
  method: "GET" | "POST";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
};

export const LISTRAK_OPERATIONS: ListrakOperation[] = [
  {
    id: "list_lists",
    method: "GET",
    path: "/email/v1/List",
    policy: "structural_read",
  },
  {
    id: "get_list",
    method: "GET",
    path: "/email/v1/List/{listId}",
    policy: "structural_read",
  },
  {
    id: "get_contact",
    method: "GET",
    path: "/email/v1/List/{listId}/Contact/{email}",
    policy: "sensitive_read",
  },
  {
    id: "upsert_contact",
    method: "POST",
    path: "/email/v1/List/{listId}/Contact",
    policy: "manage",
  },
];

export const LISTRAK_OPERATION_BY_ID = new Map(
  LISTRAK_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const LISTRAK_STRUCTURAL_READ_OPERATION_IDS = LISTRAK_OPERATIONS.filter(
  (operation) => operation.policy === "structural_read",
).map((operation) => operation.id);
export const LISTRAK_SENSITIVE_READ_OPERATION_IDS = LISTRAK_OPERATIONS.filter(
  (operation) => operation.policy === "sensitive_read",
).map((operation) => operation.id);
export const LISTRAK_MANAGE_OPERATION_IDS = LISTRAK_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
