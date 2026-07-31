export const VWO_TESTING_OPERATIONS = [
  {
    id: "list_feature_flags",
    path: "/api/v2/accounts/{accountId}/features",
    collection: true,
  },
  {
    id: "get_feature_flag",
    path: "/api/v2/accounts/{accountId}/features/{resourceId}",
    collection: false,
  },
];
export type VwoTestingOperation = (typeof VWO_TESTING_OPERATIONS)[number];
export const VWO_TESTING_OPERATION_BY_ID = new Map(
  VWO_TESTING_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const VWO_TESTING_OPERATION_IDS = VWO_TESTING_OPERATIONS.map(
  (operation) => operation.id,
);
