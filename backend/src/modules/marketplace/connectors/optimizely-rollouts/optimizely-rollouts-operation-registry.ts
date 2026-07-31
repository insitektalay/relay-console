export const OPTIMIZELY_ROLLOUTS_OPERATIONS = [
  {
    id: "list_flags",
    path: "/flags/v1/projects/{projectId}/flags",
    collection: true,
  },
  {
    id: "get_flag",
    path: "/flags/v1/projects/{projectId}/flags/{resourceId}",
    collection: false,
  },
];
export type OptimizelyRolloutsOperation =
  (typeof OPTIMIZELY_ROLLOUTS_OPERATIONS)[number];
export const OPTIMIZELY_ROLLOUTS_OPERATION_BY_ID = new Map(
  OPTIMIZELY_ROLLOUTS_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const OPTIMIZELY_ROLLOUTS_OPERATION_IDS =
  OPTIMIZELY_ROLLOUTS_OPERATIONS.map((operation) => operation.id);
