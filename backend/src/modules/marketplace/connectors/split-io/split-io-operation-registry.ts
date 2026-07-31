export const SPLIT_IO_OPERATIONS = [
  {
    id: "list_feature_flags",
    path: "/internal/api/v2/splits/ws/{workspaceId}/",
    collection: true,
  },
  {
    id: "get_feature_flag",
    path: "/internal/api/v2/splits/ws/{workspaceId}/{resourceId}",
    collection: false,
  },
];
export type SplitIoOperation = (typeof SPLIT_IO_OPERATIONS)[number];
export const SPLIT_IO_OPERATION_BY_ID = new Map(
  SPLIT_IO_OPERATIONS.map((operation) => [operation.id, operation]),
);
export const SPLIT_IO_OPERATION_IDS = SPLIT_IO_OPERATIONS.map(
  (operation) => operation.id,
);
