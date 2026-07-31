export const STATSIG_OPERATIONS = [
  {
    id: "list_gates",
    path: "/console/v1/gates",
    kind: "gate" as const,
    collection: true,
  },
  {
    id: "get_gate",
    path: "/console/v1/gates/{resourceId}",
    kind: "gate" as const,
    collection: false,
  },
  {
    id: "list_dynamic_configs",
    path: "/console/v1/dynamic_configs",
    kind: "dynamic_config" as const,
    collection: true,
  },
  {
    id: "get_dynamic_config",
    path: "/console/v1/dynamic_configs/{resourceId}",
    kind: "dynamic_config" as const,
    collection: false,
  },
  {
    id: "list_experiments",
    path: "/console/v1/experiments",
    kind: "experiment" as const,
    collection: true,
  },
  {
    id: "get_experiment",
    path: "/console/v1/experiments/{resourceId}",
    kind: "experiment" as const,
    collection: false,
  },
];

export type StatsigOperation = (typeof STATSIG_OPERATIONS)[number];
export const STATSIG_OPERATION_BY_ID = new Map(
  STATSIG_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const STATSIG_OPERATION_IDS = STATSIG_OPERATIONS.map(
  (operation) => operation.id,
);
