export type DotdigitalOperation = {
  id: string;
  method: "GET" | "PATCH";
  path: string;
  policy: "structural_read" | "sensitive_read" | "manage";
};

export const DOTDIGITAL_OPERATIONS: DotdigitalOperation[] = [
  {
    id: "list_address_books",
    method: "GET",
    path: "/v2/address-books",
    policy: "structural_read",
  },
  {
    id: "get_address_book",
    method: "GET",
    path: "/v2/address-books/{addressBookId}",
    policy: "structural_read",
  },
  {
    id: "get_contact_by_email",
    method: "GET",
    path: "/contacts/v3/email/{email}",
    policy: "sensitive_read",
  },
  {
    id: "update_contact_by_email",
    method: "PATCH",
    path: "/contacts/v3/email/{email}",
    policy: "manage",
  },
];

export const DOTDIGITAL_OPERATION_BY_ID = new Map(
  DOTDIGITAL_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const DOTDIGITAL_STRUCTURAL_READ_OPERATION_IDS =
  DOTDIGITAL_OPERATIONS.filter(
    (operation) => operation.policy === "structural_read",
  ).map((operation) => operation.id);
export const DOTDIGITAL_SENSITIVE_READ_OPERATION_IDS =
  DOTDIGITAL_OPERATIONS.filter(
    (operation) => operation.policy === "sensitive_read",
  ).map((operation) => operation.id);
export const DOTDIGITAL_MANAGE_OPERATION_IDS = DOTDIGITAL_OPERATIONS.filter(
  (operation) => operation.policy === "manage",
).map((operation) => operation.id);
