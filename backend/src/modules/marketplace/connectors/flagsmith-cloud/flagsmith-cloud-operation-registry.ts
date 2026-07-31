export const FLAGSMITH_CLOUD_OPERATIONS = [
  {
    id: "list_features",
    path: "/api/v1/projects/{projectId}/features/",
    collection: true,
  },
  {
    id: "get_feature",
    path: "/api/v1/projects/{projectId}/features/{resourceId}/",
    collection: false,
  },
];
export type FlagsmithCloudOperation =
  (typeof FLAGSMITH_CLOUD_OPERATIONS)[number];
export const FLAGSMITH_CLOUD_OPERATION_BY_ID = new Map(
  FLAGSMITH_CLOUD_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const FLAGSMITH_CLOUD_OPERATION_IDS = FLAGSMITH_CLOUD_OPERATIONS.map(
  (operation) => operation.id,
);
