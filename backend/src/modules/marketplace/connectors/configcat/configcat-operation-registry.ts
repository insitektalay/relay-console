export const CONFIGCAT_OPERATIONS = [
  {
    id: "list_flags",
    path: "/v1/configs/{configId}/settings",
    collection: true,
  },
  {
    id: "get_flag",
    path: "/v1/settings/{resourceId}",
    collection: false,
  },
];
export type ConfigCatOperation = (typeof CONFIGCAT_OPERATIONS)[number];
export const CONFIGCAT_OPERATION_BY_ID = new Map(
  CONFIGCAT_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const CONFIGCAT_OPERATION_IDS = CONFIGCAT_OPERATIONS.map(
  (operation) => operation.id,
);
