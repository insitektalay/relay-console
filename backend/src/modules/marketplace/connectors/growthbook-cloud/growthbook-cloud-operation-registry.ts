export const GROWTHBOOK_CLOUD_OPERATIONS = [
  { id: "list_features", path: "/api/v1/features", collection: true },
  {
    id: "get_feature",
    path: "/api/v1/features/{resourceId}",
    collection: false,
  },
];
export type GrowthBookCloudOperation =
  (typeof GROWTHBOOK_CLOUD_OPERATIONS)[number];
export const GROWTHBOOK_CLOUD_OPERATION_BY_ID = new Map(
  GROWTHBOOK_CLOUD_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const GROWTHBOOK_CLOUD_OPERATION_IDS = GROWTHBOOK_CLOUD_OPERATIONS.map(
  (operation) => operation.id,
);
