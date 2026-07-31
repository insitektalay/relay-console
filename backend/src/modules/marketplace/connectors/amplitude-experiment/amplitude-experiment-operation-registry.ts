export type AmplitudeExperimentOperation = {
  id: string;
  path: string;
  collection: boolean;
};

export const AMPLITUDE_EXPERIMENT_OPERATIONS: AmplitudeExperimentOperation[] = [
  { id: "list_flags", path: "/api/1/flags", collection: true },
  { id: "get_flag", path: "/api/1/flags/{resourceId}", collection: false },
  {
    id: "list_experiments",
    path: "/api/1/experiments",
    collection: true,
  },
  {
    id: "get_experiment",
    path: "/api/1/experiments/{resourceId}",
    collection: false,
  },
];

export const AMPLITUDE_EXPERIMENT_OPERATION_BY_ID = new Map(
  AMPLITUDE_EXPERIMENT_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const AMPLITUDE_EXPERIMENT_OPERATION_IDS =
  AMPLITUDE_EXPERIMENT_OPERATIONS.map((operation) => operation.id);
