export const POSTHOG_FEATURE_FLAGS_OPERATIONS = [
  {
    id: "list_active_feature_flags",
    method: "GET" as const,
    path: "/api/projects/{projectId}/feature_flags/",
    collection: true,
  },
  {
    id: "get_feature_flag",
    method: "GET" as const,
    path: "/api/projects/{projectId}/feature_flags/{resourceId}/",
    collection: false,
  },
];

export type PostHogFeatureFlagsOperation =
  (typeof POSTHOG_FEATURE_FLAGS_OPERATIONS)[number];
export const POSTHOG_FEATURE_FLAGS_OPERATION_BY_ID = new Map(
  POSTHOG_FEATURE_FLAGS_OPERATIONS.map((operation) => [
    operation.id,
    operation,
  ]),
);
export const POSTHOG_FEATURE_FLAGS_OPERATION_IDS =
  POSTHOG_FEATURE_FLAGS_OPERATIONS.map((operation) => operation.id);
