export const UNLEASH_CLOUD_OPERATIONS = [
  { id: "list_features", path: "/api/client/features", collection: true },
  {
    id: "get_feature",
    path: "/api/client/features/{resourceId}",
    collection: false,
  },
];
export type UnleashCloudOperation = (typeof UNLEASH_CLOUD_OPERATIONS)[number];
export const UNLEASH_CLOUD_OPERATION_BY_ID = new Map(
  UNLEASH_CLOUD_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const UNLEASH_CLOUD_OPERATION_IDS = UNLEASH_CLOUD_OPERATIONS.map(
  (operation) => operation.id,
);
